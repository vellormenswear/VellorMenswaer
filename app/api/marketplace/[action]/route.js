import {NextResponse} from 'next/server';
import {sql,transaction,audit} from '@/lib/db';import {getUser,requireUser} from '@/lib/auth';import {quoteCart} from '@/lib/commerce';
import {ok,fail,body,originGuard,ensure,HttpError,uuid,txt} from '@/lib/http';
import {randomToken,sha256} from '@/lib/security';
import {connectOAuth,supplierAccessToken,mpRequest} from '@/lib/marketplace';
import {distributeDiscount} from '@/lib/marketplace-rules.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const isReady=()=>process.env.MP_SPLIT_ENABLED==='true'&&process.env.MP_MODE==='sandbox'&&process.env.STORE_OPEN_FOR_ORDERS==='true'&&!!process.env.DATABASE_URL&&!!process.env.MP_CLIENT_ID&&!!process.env.MP_CLIENT_SECRET&&!!process.env.MP_TOKEN_ENCRYPTION_KEY&&!!process.env.MP_WEBHOOK_SECRET&&/^https:\/\//.test(process.env.SITE_URL||'');
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
  const u=await requireUser(req);ensure(u.role==='customer','Somente clientes.',403);const orderId=q.get('order_id');ensure(uuid(orderId),'Pedido inválido.');
  const r=await sql(`SELECT g.id,g.amount_cents,g.payment_status,g.fulfillment_status,g.checkout_url,g.tracking_code,g.carrier,g.created_at,s.business_name,o.order_number FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id JOIN orders o ON o.id=g.order_id WHERE g.order_id=$1 AND o.customer_id=$2 ORDER BY g.created_at,g.id`,[orderId,u.id]);ensure(r.rowCount,'Pedido não encontrado.',404);return ok({groups:r.rows,order_id:orderId})
 }
 throw new HttpError(404,'Ação desconhecida.');
 }catch(e){return fail(e)}}
async function createPreference(group,order,customerEmail){
 const token=await supplierAccessToken(group.supplier_id);
 const r=await sql(`SELECT si.sku_snapshot,si.quantity,oi.product_name_snapshot,oi.variant_snapshot,oi.unit_price_cents FROM supplier_order_items si JOIN order_items oi ON oi.id=si.order_item_id WHERE si.group_id=$1`,[group.id]);
 // Descontos são aplicados como item de ajuste com preço >= 0; evitamos linhas negativas.
 const units=[];for(const l of r.rows){for(let i=0;i<l.quantity;i++)units.push({id:l.sku_snapshot,title:(l.product_name_snapshot+' '+(l.variant_snapshot||'')).slice(0,190),quantity:1,currency_id:'BRL',unit_price:l.unit_price_cents})}
 let remaining=units.reduce((n,l)=>n+l.unit_price,0)-group.amount_cents;
 ensure(remaining>=0,'Desconto inválido.',409);
 for(const unit of units){const off=Math.min(unit.unit_price-1,remaining);unit.unit_price-=off;remaining-=off;if(remaining===0)break}
 ensure(remaining===0,'O desconto excede o valor permitido do grupo.',409);
 const callback=site()+'/pagamento/grupos?order_id='+encodeURIComponent(order.id);
 const payload={items:units.map(l=>({...l,unit_price:Number(brl(l.unit_price))})),marketplace_fee:Number(brl(group.marketplace_fee_cents)),external_reference:group.id,payer:{email:customerEmail},back_urls:{success:callback,failure:callback,pending:callback},notification_url:site()+'/api/webhooks/mercadopago',auto_return:'approved'};
 const mp=await mpRequest('/checkout/preferences',token,{method:'POST',data:payload,idempotency:'vellor-'+group.id});
 const url=(process.env.MP_MODE==='sandbox'?mp.sandbox_init_point:mp.init_point)||mp.init_point;
 ensure(/^https:\/\//.test(url||'')&&mp.id,'Mercado Pago não retornou uma preferência válida.',502);
 await sql('UPDATE supplier_order_groups SET preference_id=$1,checkout_url=$2,updated_at=now() WHERE id=$3',[mp.id,url,group.id]);return url;
}
export async function POST(req,{params}){try{originGuard(req);const {action}=await params;const x=await body(req,120000);
 if(action==='checkout-create'){
  ensure(isReady(),'Checkout Split de testes ainda não habilitado. Configure credenciais, fornecedor e webhooks.',503);
  const u=await requireUser(req);ensure(u.role==='customer','Somente clientes podem comprar.',403);
  ensure(uuid(x.address_id),'Endereço inválido.');const addr=await sql('SELECT * FROM addresses WHERE id=$1 AND user_id=$2',[x.address_id,u.id]);ensure(addr.rowCount,'Endereço não encontrado.',404);
  const quote=await quoteCart(x.items,x.coupon);ensure(quote.shipping_cents===0,'O frete deve estar incluído no preço dos fornecedores.',409);
  // Valores sempre recalculados; pedidos de fornecedores sem acesso OAuth não são emitidos.
  const ids=quote.items.map(i=>i.variant_id);
  const rows=await sql(`SELECT v.id,v.supplier_cost_cents,p.supplier_id,s.status,EXISTS(SELECT 1 FROM supplier_mp_connections mp WHERE mp.supplier_id=s.id) AS mp_connected,
   v.stock_mode,v.stock,v.supplier_available,v.preparation_days,v.delivery_days_min,v.delivery_days_max FROM product_variants v JOIN products p ON p.id=v.product_id LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE v.id=ANY($1::uuid[])`,[ids]);
  const byId=new Map(rows.rows.map(r=>[r.id,r]));
  const grouped=new Map();for(const item of quote.items){const r=byId.get(item.variant_id);ensure(r?.supplier_id&&r.status==='active'&&r.mp_connected&&Number.isInteger(r.supplier_cost_cents),'Este produto ainda não está habilitado para vendas com Split. Aguarde a vinculação do fornecedor.',409);ensure(r.supplier_available,'Produto indisponível.',409);const group=grouped.get(r.supplier_id)||{supplier_id:r.supplier_id,items:[],subtotal:0,cost:0};group.items.push({...item,cost_cents:r.supplier_cost_cents,stock_mode:r.stock_mode,preparation_days:r.preparation_days||2,delivery_days_min:r.delivery_days_min||5,delivery_days_max:r.delivery_days_max||15});group.subtotal+=item.line_cents;group.cost+=r.supplier_cost_cents*item.qty;grouped.set(r.supplier_id,group)}
  ensure(grouped.size>=1&&grouped.size<=20,'Número de fornecedores excede o limite.',400);
  // Distribuição determinística do cupom, mantendo a soma exata dos descontos.
  const gList=distributeDiscount([...grouped.values()],quote.discount_cents);for(let i=0;i<gList.length;i++){
   const g=gList[i];
   ensure(g.total>0&&g.total>=g.cost,'O desconto reduz a venda abaixo do custo do fornecedor. Revise os preços ou cupom.',409);
  }
  const order=await transaction(async c=>{
   // Atualização concorrente do estoque: reserva efetiva contra quantidades vendáveis.
   for(const item of quote.items){const r=byId.get(item.variant_id);if(r.stock_mode==='quantity'){
    const result=await c.query(`UPDATE product_variants SET stock=stock-$1,updated_at=now() WHERE id=$2 AND stock_mode='quantity' AND stock>=$1 AND supplier_available=true RETURNING id`,[item.qty,item.variant_id]);ensure(result.rowCount,`Sem estoque para ${item.sku}.`,409);
   }}
   const o=(await c.query(`INSERT INTO orders(customer_id,recipient_snapshot,subtotal_cents,discount_cents,shipping_cents,total_cents,coupon_id,coupon_code_snapshot) VALUES($1,$2,$3,$4,0,$5,$6,$7) RETURNING *`,[u.id,JSON.stringify(addr.rows[0]),quote.subtotal_cents,quote.discount_cents,quote.total_cents,quote.coupon?.id||null,quote.coupon?.code||null])).rows[0];
   for(const g of gList){const gg=(await c.query(`INSERT INTO supplier_order_groups(order_id,supplier_id,amount_cents,supplier_amount_cents,marketplace_fee_cents,preparation_days,delivery_days_min,delivery_days_max) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[o.id,g.supplier_id,g.total,g.cost,g.total-g.cost,Math.max(...g.items.map(x=>x.preparation_days)),Math.max(...g.items.map(x=>x.delivery_days_min)),Math.max(...g.items.map(x=>x.delivery_days_max))])).rows[0];g.id=gg.id;
    for(const item of g.items){const ins=await c.query(`INSERT INTO order_items(order_id,variant_id,sku_snapshot,product_name_snapshot,variant_snapshot,size_snapshot,image_url_snapshot,quantity,unit_price_cents,line_total_cents) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[o.id,item.variant_id,item.sku,item.name,item.variant,item.size,item.image,item.qty,item.unit_cents,item.line_cents]);
     await c.query(`INSERT INTO supplier_order_items(group_id,order_item_id,variant_id,sku_snapshot,size_snapshot,quantity,unit_cost_cents,supplier_line_cents) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[g.id,ins.rows[0].id,item.variant_id,item.sku,item.size,item.qty,item.cost_cents,item.qty*item.cost_cents]);
     if(item.stock_mode==='quantity')await c.query(`INSERT INTO supplier_stock_reservations(group_id,variant_id,quantity) VALUES($1,$2,$3) ON CONFLICT(group_id,variant_id) DO UPDATE SET quantity=supplier_stock_reservations.quantity+excluded.quantity`,[g.id,item.variant_id,item.qty]);
    }
   }return o;
  });
  const links=[];for(const g of gList){try{const link=await createPreference(g,order,u.email);links.push({group_id:g.id,checkout_url:link,amount_cents:g.total,status:'pending'})}catch(e){links.push({group_id:g.id,checkout_url:null,amount_cents:g.total,status:'setup_failed',error:'Preferência de pagamento indisponível; contate a loja.'})}}
  return ok({order_id:order.id,order_number:order.order_number,groups:links,mode:'sandbox'},201);
 }
 if(action==='retry-preference'){
  ensure(isReady(),'Checkout desabilitado.',503);const u=await requireUser(req);ensure(u.role==='customer'&&uuid(x.group_id),'Pedido inválido.',403);
  const r=await sql(`SELECT g.*,o.customer_id FROM supplier_order_groups g JOIN orders o ON o.id=g.order_id WHERE g.id=$1 AND o.customer_id=$2`,[x.group_id,u.id]);ensure(r.rowCount,'Grupo inexistente.',404);const g=r.rows[0];ensure(g.payment_status==='pending','Não é possível repetir este pagamento.',409);
  if(g.checkout_url)return ok({checkout_url:g.checkout_url});
  const url=await createPreference(g,{id:g.order_id},u.email);return ok({checkout_url:url});
 }
 throw new HttpError(404,'Ação desconhecida.');
 }catch(e){return fail(e)}}
