import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {HttpError,ensure} from '@/lib/http';
import {sql,transaction} from '@/lib/db';
import {supplierCommission} from '@/lib/marketplace-rules.mjs';
export function feeOf(amount,cost){return supplierCommission(amount,cost)}
export function supplierVariantValid(v){
 const price=Number(v.cost_cents),stock=v.stock===null?null:Number(v.stock),mode=v.stock_mode||'quantity';
 return typeof v.sku==='string'&&/^[A-Z0-9][A-Z0-9_-]{2,118}$/i.test(v.sku)&&typeof v.label==='string'&&v.label.trim().length>0&&Number.isInteger(price)&&price>=1&&['quantity','availability'].includes(mode)&&(mode==='availability'||Number.isInteger(stock)&&stock>=0)&&typeof v.image_url==='string'&&(v.image_url.startsWith('https://')||v.image_url.startsWith('/product-images/'));
}
function getKey(){const hex=process.env.MP_TOKEN_ENCRYPTION_KEY||'';ensure(/^[a-f0-9]{64}$/i.test(hex),'Configure MP_TOKEN_ENCRYPTION_KEY (32 bytes hex).',503);return Buffer.from(hex,'hex')}
export function encryptSecret(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',getKey(),iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.')}
export function decryptSecret(value){const [nonce,tag,data]=String(value||'').split('.');ensure(nonce&&tag&&data,'Token OAuth inválido.',503);const decipher=createDecipheriv('aes-256-gcm',getKey(),Buffer.from(nonce,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8')}
export async function mpRequest(endpoint,accessToken,{method='GET',data=null,idempotency=null}={}){
 const headers={'Authorization':`Bearer ${accessToken}`,'Content-Type':'application/json'};
 if(idempotency)headers['X-Idempotency-Key']=idempotency;
 const res=await fetch('https://api.mercadopago.com'+endpoint,{method,headers,body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
 const payload=await res.json().catch(()=>({}));if(!res.ok)throw new HttpError(502,`Mercado Pago retornou erro HTTP ${res.status}.`);return payload;
}
async function oauthRequest(data){
 const response=await fetch('https://api.mercadopago.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(15000)});
 const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.access_token)throw new HttpError(502,'Falha ao autorizar a conta Mercado Pago.');return payload;
}
export async function connectOAuth(supplierId,code){
 const p=await oauthRequest({client_id:process.env.MP_CLIENT_ID,client_secret:process.env.MP_CLIENT_SECRET,code,grant_type:'authorization_code',redirect_uri:process.env.MP_OAUTH_REDIRECT_URI,test_token:false});
 if(process.env.MP_MODE==='sandbox'){
  const allowed=String(process.env.MP_SANDBOX_TEST_SELLER_USER_ID||'').trim();
  ensure(/^\d+$/.test(allowed),'Configure o ID do vendedor de teste antes de autorizar.',503);
  ensure(String(p.user_id||'')===allowed,'Conta do Mercado Pago nao corresponde ao vendedor de teste autorizado.',403);
  ensure(String(p.access_token||'').startsWith('APP_USR-'),'Reconecte o vendedor com um Access Token APP_USR valido para o Checkout Pro de teste.',409);
 }
 await sql(`INSERT INTO supplier_mp_connections(supplier_id,provider_user_id,token_encrypted,refresh_encrypted,expires_at) VALUES($1,$2,$3,$4,now()+($5::int*interval '1 second'))
 ON CONFLICT(supplier_id) DO UPDATE SET provider_user_id=excluded.provider_user_id,token_encrypted=excluded.token_encrypted,refresh_encrypted=excluded.refresh_encrypted,expires_at=excluded.expires_at,updated_at=now()`,[supplierId,String(p.user_id||''),encryptSecret(p.access_token),p.refresh_token?encryptSecret(p.refresh_token):null,Number(p.expires_in)||15552000]);
}
export async function supplierAccessToken(supplierId){
 const r=await sql('SELECT * FROM supplier_mp_connections WHERE supplier_id=$1',[supplierId]);ensure(r.rowCount,'Fornecedor precisa conectar sua conta Mercado Pago.',409);const connection=r.rows[0];
 if(new Date(connection.expires_at).getTime()>Date.now()+10*60*1000)return decryptSecret(connection.token_encrypted);
 ensure(connection.refresh_encrypted,'Autorização expirada. Reconecte a conta.',409);
 const p=await oauthRequest({client_id:process.env.MP_CLIENT_ID,client_secret:process.env.MP_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:decryptSecret(connection.refresh_encrypted)});
 await sql(`UPDATE supplier_mp_connections SET token_encrypted=$1,refresh_encrypted=$2,expires_at=now()+($3::int*interval '1 second'),updated_at=now() WHERE supplier_id=$4`,[encryptSecret(p.access_token),encryptSecret(p.refresh_token||decryptSecret(connection.refresh_encrypted)),Number(p.expires_in)||15552000,supplierId]);return p.access_token;
}
export async function releaseReservations(c,groupId){
 const rs=await c.query(`SELECT r.*,g.checkout_batch_id FROM supplier_stock_reservations r JOIN supplier_order_groups g ON g.id=r.group_id
   WHERE r.group_id=$1 AND r.status IN ('held','committed') FOR UPDATE OF r`,[groupId]);
 for(const r of rs.rows){
  // No fluxo novo, 'held' é reserva lógica: estoque só foi debitado na aprovação.
  // No fluxo antigo, o estoque já era debitado antes de abrir o pagamento.
  if(r.status==='committed'||(r.status==='held'&&!r.checkout_batch_id))
   await c.query("UPDATE product_variants SET stock=stock+$1 WHERE id=$2 AND stock_mode='quantity'",[r.quantity,r.variant_id]);
  await c.query("UPDATE supplier_stock_reservations SET status='released',updated_at=now() WHERE id=$1",[r.id]);
 }
}
export async function syncOrderPayment(c,orderId){
 const r=await c.query('SELECT payment_status,checkout_batch_id FROM supplier_order_groups WHERE order_id=$1',[orderId]);const statuses=r.rows.map(x=>x.payment_status);
 if(!statuses.length)return;
 const approved=statuses.every(x=>x==='approved');
 await c.query("UPDATE orders SET status=CASE WHEN $2 AND status='awaiting_payment' THEN 'paid' ELSE status END, payment_status=CASE WHEN $2 THEN 'approved' ELSE payment_status END,paid_at=CASE WHEN $2 THEN COALESCE(paid_at,now()) ELSE paid_at END,updated_at=now() WHERE id=$1",[orderId,approved]);
 // Pedidos da nova arquitetura registram uma utilização de cupom por checkout_batch.
 if(approved&&!r.rows.some(x=>x.checkout_batch_id)){
  const found=await c.query('SELECT coupon_id,customer_id,discount_cents FROM orders WHERE id=$1',[orderId]);const o=found.rows[0];
  if(o?.coupon_id){const x=await c.query('INSERT INTO coupon_redemptions(coupon_id,order_id,user_id,discount_cents) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO NOTHING RETURNING id',[o.coupon_id,orderId,o.customer_id,o.discount_cents]);if(x.rowCount)await c.query('UPDATE coupons SET used_count=used_count+1 WHERE id=$1',[o.coupon_id]);}
 }
}
