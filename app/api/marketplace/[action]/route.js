import {NextResponse} from 'next/server';
import {sql,transaction,audit} from '@/lib/db';import {getUser,requireUser} from '@/lib/auth';import {quoteCart} from '@/lib/commerce';
import {ok,fail,body,originGuard,ensure,HttpError,uuid,txt} from '@/lib/http';
import {randomToken,sha256} from '@/lib/security';
import {connectOAuth,supplierAccessToken,mpRequest} from '@/lib/marketplace';
import {distributeDiscount} from '@/lib/marketplace-rules.mjs';
import {checkoutReady,checkoutAllowedForUser,discountedPreferenceItems} from '@/lib/supplier-checkout.mjs';
import {randomUUID} from 'node:crypto';
export const runtime='nodejs';export const dynamic='force-dynamic';
const isReady=()=>checkoutReady(process.env);
const site=()=>{const value=(process.env.SITE_URL||'').replace(/\/$/,'');ensure(value.startsWith('https://'),'Defina SITE_URL HTTPS.',503);return value};
const brl=c=>Number(c/100).toFixed(2);
async function verifyUserSupplier(req){const user=await requireUser(req);ensure(user.role==='supplier','Acesso restrito aos fornecedores.',403);const r=await sql('SELECT * FROM suppliers WHERE user_id=$1 AND status=$2',[user.id,'active']);ensure(r.rowCount,'Fornecedor suspenso ou não encontrado.',403);return r.rows[0]}
export async function GET(req,{params}){try{const {action}=await params;const q=new URL(req.url).searchParams;
 if(action==='oauth-start'){
  const s=await verifyUserSupplier(req);ensure(process.env.MP_CLIENT_ID&&process.env.MP_CLIENT_SECRET&&process.env.MP_OAUTH_REDIRECT_URI,'OAuth do Mercado Pago ainda não foi configurado.',503);
  ensure(process.env.MP_OAUTH_REDIRECT_URI===site()+'/api/marketplace/oauth-callback','URL de retorno OAuth diferente da URL configurada no site.',503);
  const state=randomToken();await sql("INSERT INTO supplier_oauth_states(state_hash,supplier_id,expires_at) VALUES($1,$2,now()+interval '10 minutes')",[sha256(state),s.id]);
  const url=new URL('https://auth.mercadopago.com/authorization');url.searchParams.set('client_id',process.env.MP_CLIENT_ID);url.searchParams.set('response_type','code');url.searchParams.set('platform_id','mp');url.searchParams.set('state',state);url.searchParams.set('redirect_uri',process.env.MP_OAUTH_REDIRECT_URI);
  return NextResponse.redirect(url,303)
 }
 if(action==='oauth-callback'){
  const u=await getUser(req);ensure(u?.role==='supplier','Faça login na conta do fornecedor antes de conectar o Mercado Pago.',401);
  if(q.get('error'))return NextResponse.redirect(site()+'/fornecedor?mp=negado',303);
  const token=txt(q.get('state'),200),code=txt(q.get('code'),500);ensure(token.length>20&&code.length>8,'Retorno OAuth inválido.',400);
  const r=await transaction(async c=>{const v=await c.query('SELECT state_hash,supplier_id FROM supplier_oauth_states WHERE state_hash=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',[sha256(token)]);ensure(v.rowCount,'Sessão de autorização expirada.',403);const own=await c.query('SELECT 1 FROM suppliers WHERE id=$1 AND user_id=$2 AND status=$3',[v.rows[0].supplier_id,u.id,'active']);ensure(own.rowCount,'Fornecedor não corresponde à autorização.',403);await c.query('UPDATE supplier_oauth_states SET consumed_at=now() WHERE state_hash=$1',[sha256(token)]);return v.rows[0]});
  await connectOAuth(r.supplier_id,code);return NextResponse.redirect(site()+'/fornecedor?mp=conectado',303)
 }
 if(action==='groups'){
  const u=await requireUser(req);ensure(u.role==='customer','Somente clientes.',403);
  const checkoutId=q.get('checkout_id'),orderId=q.get('order_id');
  let batch=checkoutId;
  if(!batch&&uuid(orderId)){
   const lookup=await sql(`SELECT g.checkout_batch_id FROM supplier_order_groups g JOIN orders o ON o.id=g.order_id WHERE g.order_id=$1 AND o.customer_id=$2 LIMIT 1`,[orderId,u.id]);
   if(lookup.rowCount&&lookup.rows[0].checkout_batch_id)batch=lookup.rows[0].checkout_batch_id;
  }
  let r;
  if(uuid(batch))r=await sql(`SELECT g.id,g.order_id,g.checkout_batch_id,g.amount_cents,g.payment_status,g.fulfillment_status,g.checkout_url,g.tracking_code,g.carrier,g.created_at,g.checkout_expires_at,s.business_name,o.order_number
    FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id LEFT JOIN orders o ON o.id=g.order_id
    WHERE g.checkout_batch_id=$1 AND g.customer_id=$2 ORDER BY g.created_at,g.id`,[batch,u.id]);
  else if(uuid(orderId))r=await sql(`SELECT g.id,g.order_id,g.checkout_batch_id,g.amount_cents,g.payment_status,g.fulfillment_status,g.checkout_url,g.tracking_code,g.carrier,g.created_at,g.checkout_expires_at,s.business_name,o.order_number
    FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id JOIN orders o ON o.id=g.order_id
    WHERE g.order_id=$1 AND o.customer_id=$2 ORDER BY g.created_at,g.id`,[orderId,u.id]);
  else throw new HttpError(400,'Referência de checkout inválida.');
  ensure(r.rowCount,'Pagamento não encontrado.',404);
  return ok({groups:r.rows,checkout_id:batch||null,order_id:orderId||null});
 }
 throw new HttpError(404,'Ação desconhecida.');
 }catch(e){return fail(e)}}
async function createPreference(group,customerEmail){
 const token=await supplierAccessToken(group.supplier_id);
 const items=group.items_snapshot;
 ensure(Array.isArray(items)&&items.length>0,'Itens da tentativa não encontrados.',409);
 let units;try{units=discountedPreferenceItems(items,group.amount_cents)}catch{throw new HttpError(409,'Desconto do grupo inválido.')}
 const callback=site()+'/pagamento/grupos?checkout_id='+encodeURIComponent(group.checkout_batch_id);
 const until=new Date(group.checkout_expires_at);
 ensure(until.getTime()>Date.now(),'O prazo desta tentativa de pagamento expirou. Crie um novo checkout.',409);
 const payload={items:units,marketplace_fee:Number(brl(group.marketplace_fee_cents)),external_reference:group.id,
   payer:{email:customerEmail},back_urls:{success:callback,failure:callback,pending:callback},
   notification_url:site()+'/api/webhooks/mercadopago?group='+encodeURIComponent(group.id),auto_return:'approved',
   expires:true,expiration_date_from:new Date().toISOString(),expiration_date_to:until.toISOString()};
 const mp=await mpRequest('/checkout/preferences',token,{method:'POST',data:payload,idempotency:'vellor-'+group.id});
 const url=process.env.MP_MODE==='sandbox'?mp.sandbox_init_point:mp.init_point;
 ensure(/^https:\/\//.test(url||'')&&mp.id,'Mercado Pago não retornou uma preferência válida.',502);
 await sql('UPDATE supplier_order_groups SET preference_id=$1,checkout_url=$2,updated_at=now() WHERE id=$3 AND order_id IS NULL',[mp.id,url,group.id]);return url;
}
export async function POST(req,{params}){try{originGuard(req);const {action}=await params;const x=await body(req,120000);
 if(action==='checkout-create'){
  ensure(isReady(),'Checkout Split ainda não habilitado. Configure credenciais, fornecedores e webhooks.',503);
  const u=await requireUser(req);ensure(u.role==='customer','Somente clientes podem comprar.',403);
  ensure(checkoutAllowedForUser(process.env,u),'Checkout sandbox restrito à conta compradora de teste.',403);
  ensure(uuid(x.address_id),'Endereço inválido.');const addr=await sql('SELECT * FROM addresses WHERE id=$1 AND user_id=$2',[x.address_id,u.id]);ensure(addr.rowCount,'Endereço não encontrado.',404);
  const quote=await quoteCart(x.items,x.coupon);ensure(quote.shipping_cents===0,'O frete deve estar incluído no preço dos fornecedores.',409);
  const ids=quote.items.map(i=>i.variant_id);
  const rows=await sql(`SELECT v.id,v.supplier_cost_cents,p.supplier_id,s.status,EXISTS(SELECT 1 FROM supplier_mp_connections mp WHERE mp.supplier_id=s.id) AS mp_connected,
   v.stock_mode,v.stock,v.supplier_available,v.preparation_days,v.delivery_days_min,v.delivery_days_max FROM product_variants v JOIN products p ON p.id=v.product_id LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE v.id=ANY($1::uuid[])`,[ids]);
  const byId=new Map(rows.rows.map(r=>[r.id,r]));
  const grouped=new Map();for(const item of quote.items){const r=byId.get(item.variant_id);
   ensure(r?.supplier_id&&r.status==='active'&&r.mp_connected&&Number.isInteger(r.supplier_cost_cents),'Este produto ainda não está habilitado para vendas com Split. Aguarde a vinculação do fornecedor.',409);
   ensure(r.supplier_available,'Produto indisponível.',409);
   const group=grouped.get(r.supplier_id)||{supplier_id:r.supplier_id,items:[],subtotal:0,cost:0};
   group.items.push({...item,cost_cents:r.supplier_cost_cents,stock_mode:r.stock_mode,preparation_days:r.preparation_days||2,delivery_days_min:r.delivery_days_min||5,delivery_days_max:r.delivery_days_max||15});
   group.subtotal+=item.line_cents;group.cost+=r.supplier_cost_cents*item.qty;grouped.set(r.supplier_id,group);
  }
  ensure(grouped.size>=1&&grouped.size<=20,'Número de fornecedores excede o limite.',400);
  const gList=distributeDiscount([...grouped.values()],quote.discount_cents);
  for(const g of gList)ensure(g.total>0&&g.total>=g.cost,'Cupom reduz o preço abaixo do custo de fornecimento.',409);
  // Cada grupo é só uma intenção de pagamento; nenhuma linha em orders antes da aprovação.
  const batch=randomUUID();
  const groups=await transaction(async c=>{
   const locked=await c.query('SELECT id,stock,stock_mode,supplier_available FROM product_variants WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
   const fresh=new Map(locked.rows.map(r=>[r.id,r]));
   const quantities=new Map();
   for(const item of quote.items)quantities.set(item.variant_id,(quantities.get(item.variant_id)||0)+item.qty);
   for(const [variantId,quantity] of quantities){const variant=fresh.get(variantId);ensure(variant?.supplier_available,'Produto indisponível.',409);
    if(variant.stock_mode==='quantity'){
     const pending=await c.query(`SELECT COALESCE(SUM(res.quantity),0)::int AS qty FROM supplier_stock_reservations res JOIN supplier_order_groups g ON g.id=res.group_id
        WHERE res.variant_id=$1 AND res.status='held' AND g.order_id IS NULL AND g.checkout_expires_at>now()`,[variantId]);
     ensure(variant.stock>=quantity+pending.rows[0].qty,'Estoque reservado por outro checkout. Tente novamente mais tarde.',409);
    }
   }
   const result=[];
   for(const g of gList){
    const rr=await c.query(`INSERT INTO supplier_order_groups(checkout_batch_id,customer_id,recipient_snapshot,items_snapshot,subtotal_cents,discount_cents,coupon_id,coupon_code_snapshot,checkout_expires_at,
       supplier_id,amount_cents,supplier_amount_cents,marketplace_fee_cents,preparation_days,delivery_days_min,delivery_days_max)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '2 hours',$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [batch,u.id,JSON.stringify(addr.rows[0]),JSON.stringify(g.items),g.subtotal,g.discount,quote.coupon?.id||null,quote.coupon?.code||null,
       g.supplier_id,g.total,g.cost,g.total-g.cost,Math.max(...g.items.map(i=>i.preparation_days)),Math.max(...g.items.map(i=>i.delivery_days_min)),Math.max(...g.items.map(i=>i.delivery_days_max))]);
    const group=rr.rows[0];
    for(const item of g.items){if(item.stock_mode==='quantity')await c.query(`INSERT INTO supplier_stock_reservations(group_id,variant_id,quantity)
       VALUES($1,$2,$3) ON CONFLICT(group_id,variant_id) DO UPDATE SET quantity=supplier_stock_reservations.quantity+excluded.quantity`,[group.id,item.variant_id,item.qty]);}
    result.push(group);
   }
   return result;
  });
  const links=[];for(const group of groups){try{const url=await createPreference(group,u.email);links.push({group_id:group.id,checkout_url:url,amount_cents:group.amount_cents,status:'pending'})}
   catch(e){links.push({group_id:group.id,checkout_url:null,amount_cents:group.amount_cents,status:'setup_failed',error:'Preferência indisponível; utilize a opção gerar pagamento.'})}}
  return ok({checkout_id:batch,groups:links,mode:process.env.MP_MODE},201);
 }
 if(action==='retry-preference'){
  ensure(isReady(),'Checkout desabilitado.',503);const u=await requireUser(req);
  ensure(u.role==='customer'&&uuid(x.group_id),'Pagamento inválido.',403);
  ensure(checkoutAllowedForUser(process.env,u),'Checkout sandbox restrito à conta compradora de teste.',403);
  const r=await sql('SELECT g.* FROM supplier_order_groups g WHERE g.id=$1 AND g.customer_id=$2 AND g.order_id IS NULL',[x.group_id,u.id]);
  ensure(r.rowCount,'Tentativa não encontrada.',404);const g=r.rows[0];ensure(g.payment_status==='pending','Não é possível repetir este pagamento.',409);
  ensure(new Date(g.checkout_expires_at).getTime()>Date.now(),'Tentativa expirada: volte ao carrinho e gere outra.',409);
  if(g.checkout_url)return ok({checkout_url:g.checkout_url});
  const url=await createPreference(g,u.email);return ok({checkout_url:url});
 }
 throw new HttpError(404,'Ação desconhecida.');
 }catch(e){return fail(e)}}
