import {sql,transaction} from '@/lib/db';
import {quoteCart} from '@/lib/commerce';
import {requireUser} from '@/lib/auth';
import {ok,fail,ensure,body,originGuard,HttpError,uuid} from '@/lib/http';
import {randomUUID} from 'node:crypto';
import {distributeDiscount} from '@/lib/marketplace-rules.mjs';
import {infinitepayApi,infinitepayLink} from '@/lib/infinitepay-api';
import {infinitepayReady,buildInfinitepayCheckout,safeInfiniteRef} from '@/lib/infinitepay.mjs';
import {reconcileInfinitepayBatch} from '@/lib/infinitepay-reconcile';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function customer(req){const u=await requireUser(req);ensure(u.role==='customer','Somente compradores.',403);return u}
async function createCheckout(batch,u){
 const existing=await sql('SELECT * FROM infinitepay_checkout_batches WHERE checkout_batch_id=$1 AND customer_id=$2',[batch,u.id]);
 if(existing.rowCount){ensure(existing.rows[0].checkout_url,'Checkout ainda nao finalizado.',409);return{checkout_url:existing.rows[0].checkout_url,checkout_id:batch}}
 const groups=await sql("SELECT g.* FROM supplier_order_groups g WHERE g.checkout_batch_id=$1 AND g.customer_id=$2 AND g.payment_status='pending' AND g.order_id IS NULL ORDER BY g.id",[batch,u.id]);
 ensure(groups.rowCount&&groups.rows.every(g=>new Date(g.checkout_expires_at)>new Date()),'Checkout expirado ou itens indisponiveis.',409);
 const info=buildInfinitepayCheckout(groups.rows,{batchId:batch,site:process.env.SITE_URL.replace(/\/$/,''),
  expiresAt:groups.rows[0].checkout_expires_at});
 // Reserva idempotente ANTES da chamada externa: dois requests simultaneos
 // nao podem criar dois links diferentes para o mesmo lote.
 const reserved=await sql("INSERT INTO infinitepay_checkout_batches(checkout_batch_id,customer_id,order_nsu,total_cents,supplier_cents,status) VALUES($1,$2,$3,$4,$5,'creating') ON CONFLICT(checkout_batch_id) DO NOTHING RETURNING checkout_batch_id",
  [batch,u.id,batch,info.total_cents,info.supplier_cents]);
 if(!reserved.rowCount){
  const old=await sql('SELECT checkout_url,status FROM infinitepay_checkout_batches WHERE checkout_batch_id=$1 AND customer_id=$2',[batch,u.id]);
  ensure(old.rowCount&&old.rows[0].status==='pending'&&old.rows[0].checkout_url,
   'Checkout em preparacao; nao gere outra cobranca para este carrinho.',409);
  return {checkout_url:old.rows[0].checkout_url,checkout_id:batch};
 }
 // Falhas de rede podem deixar status=creating. Nao gerar novamente:
 // a InfinitePay nao permite recuperar ou cancelar links por order_nsu.
 const result=await infinitepayApi('/links',{handle:process.env.INFINITEPAY_HANDLE,...info.payload});
 const url=infinitepayLink(result);ensure(url,'InfinitePay nao retornou URL de checkout valida.',502);
 await transaction(async c=>{
  const row=await c.query("UPDATE infinitepay_checkout_batches SET checkout_url=$1,status='pending',updated_at=now() WHERE checkout_batch_id=$2 AND customer_id=$3 AND status='creating' RETURNING checkout_batch_id",
   [url,batch,u.id]);
  ensure(row.rowCount,'Checkout alterado durante a criacao.',409);
  await c.query("UPDATE supplier_order_groups SET checkout_url=$1,updated_at=now() WHERE checkout_batch_id=$2 AND customer_id=$3 AND payment_status='pending'",[url,batch,u.id]);
 });
 return {checkout_url:url,checkout_id:batch};
}
export async function GET(req,{params}){try{
 const {action}=await params;ensure(action==='groups','Rota invalida.',404);const u=await customer(req);
 const q=new URL(req.url).searchParams;let batch=q.get('checkout_id');
 if(!batch&&uuid(q.get('order_id'))){const r=await sql('SELECT checkout_batch_id FROM supplier_order_groups WHERE order_id=$1 AND customer_id=$2 LIMIT 1',[q.get('order_id'),u.id]);batch=r.rows[0]?.checkout_batch_id}
 ensure(uuid(batch),'Checkout invalido.',400);
 const r=await sql('SELECT g.id,g.order_id,g.checkout_batch_id,g.amount_cents,g.payment_status,g.fulfillment_status,b.checkout_url,g.tracking_code,g.carrier,g.created_at,g.checkout_expires_at,o.order_number FROM supplier_order_groups g LEFT JOIN orders o ON o.id=g.order_id JOIN infinitepay_checkout_batches b ON b.checkout_batch_id=g.checkout_batch_id WHERE g.checkout_batch_id=$1 AND g.customer_id=$2 ORDER BY g.created_at,g.id',[batch,u.id]);
 ensure(r.rowCount,'Nenhuma tentativa encontrada.',404);
 return ok({checkout_id:batch,groups:r.rows,provider:'infinitepay',mode:'real_disabled_by_default'});
 }catch(e){return fail(e)}}
export async function POST(req,{params}){try{
 originGuard(req);const {action}=await params;const u=await customer(req);
 const x=await body(req,120000);
 if(action==='recheck-payment'){
  ensure(uuid(x.checkout_id),'Identificador invalido.',400);
  const found=await sql('SELECT 1 FROM infinitepay_checkout_batches WHERE checkout_batch_id=$1 AND customer_id=$2',[x.checkout_id,u.id]);
  ensure(found.rowCount,'Checkout nao pertence ao cliente.',403);ensure(safeInfiniteRef(x.transaction_nsu)&&safeInfiniteRef(x.slug),'Referencias invalidas.',400);return ok(await reconcileInfinitepayBatch(x.checkout_id,{transaction_nsu:x.transaction_nsu,invoice_slug:x.slug}));
 }
 // Confirmar uma venda ja realizada continua possivel, mesmo que o checkout comercial seja desligado.
 ensure(infinitepayReady(process.env,u),'Checkout InfinitePay bloqueado ate homologacao.',503);
 if(action==='retry-checkout'){
  ensure(uuid(x.checkout_id),'Identificador invalido.',400);
  return ok(await createCheckout(x.checkout_id,u));
 }
 ensure(action==='checkout-create','Ação desconhecida.',404);
 ensure(uuid(x.address_id),'Endereco invalido.',400);
 const addr=await sql('SELECT * FROM addresses WHERE id=$1 AND user_id=$2',[x.address_id,u.id]);
 ensure(addr.rowCount,'Endereco nao encontrado.',404);
 const quote=await quoteCart(x.items,x.coupon);
 ensure(quote.items.length&&quote.items.length<=60&&quote.shipping_cents===0,'Itens ou frete invalidos.',409);
 const ids=quote.items.map(i=>i.variant_id);
 const found=await sql('SELECT v.id,v.supplier_cost_cents,p.supplier_id,s.status,v.stock_mode,v.stock,v.supplier_available,v.preparation_days,v.delivery_days_min,v.delivery_days_max FROM product_variants v JOIN products p ON p.id=v.product_id JOIN suppliers s ON s.id=p.supplier_id WHERE v.id=ANY($1::uuid[])',[ids]);
 const byId=new Map(found.rows.map(v=>[v.id,v]));const grouped=new Map();
 for(const item of quote.items){
  const v=byId.get(item.variant_id);
  ensure(v?.supplier_id&&v.status==='active'&&v.supplier_available&&Number.isSafeInteger(v.supplier_cost_cents),'Fornecedor sem cadastro ou produto indisponivel.',409);
  const g=grouped.get(v.supplier_id)||{supplier_id:v.supplier_id,items:[],subtotal:0,cost:0};
  g.items.push({...item,cost_cents:v.supplier_cost_cents,stock_mode:v.stock_mode,preparation_days:v.preparation_days||2,delivery_days_min:v.delivery_days_min||5,delivery_days_max:v.delivery_days_max||15});
  g.subtotal+=item.line_cents;g.cost+=v.supplier_cost_cents*item.qty;grouped.set(v.supplier_id,g);
 }
 const list=distributeDiscount([...grouped.values()],quote.discount_cents);
 ensure(list.every(g=>g.total>g.cost)&&list.length<=20,'Valor insuficiente para os fornecedores e taxas.',409);
 const batch=randomUUID();
 await transaction(async c=>{
  const locked=await c.query('SELECT id,stock,stock_mode,supplier_available,active FROM product_variants WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
  const fresh=new Map(locked.rows.map(v=>[v.id,v]));const quantities=new Map();
  for(const item of quote.items)quantities.set(item.variant_id,(quantities.get(item.variant_id)||0)+item.qty);
  for(const [id,n] of quantities){
   const v=fresh.get(id);ensure(v?.supplier_available&&v.active,'Produto indisponivel.',409);
   if(v.stock_mode==='quantity'){
    const r=await c.query("SELECT COALESCE(SUM(res.quantity),0)::int AS qty FROM supplier_stock_reservations res JOIN supplier_order_groups g ON g.id=res.group_id WHERE res.variant_id=$1 AND res.status='held' AND g.order_id IS NULL AND g.checkout_expires_at>now()",[id]);
    ensure(v.stock>=n+r.rows[0].qty,'Estoque insuficiente.',409);
   }
  }
  for(const g of list){
   const r=await c.query("INSERT INTO supplier_order_groups(checkout_batch_id,customer_id,recipient_snapshot,items_snapshot,subtotal_cents,discount_cents,coupon_id,coupon_code_snapshot,checkout_expires_at,supplier_id,amount_cents,supplier_amount_cents,marketplace_fee_cents,preparation_days,delivery_days_min,delivery_days_max) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '2 hours',$9,$10,$11,$12,$13,$14,$15) RETURNING id",
    [batch,u.id,JSON.stringify(addr.rows[0]),JSON.stringify(g.items),g.subtotal,g.discount,quote.coupon?.id||null,quote.coupon?.code||null,g.supplier_id,g.total,g.cost,g.total-g.cost,Math.max(...g.items.map(i=>i.preparation_days)),Math.max(...g.items.map(i=>i.delivery_days_min)),Math.max(...g.items.map(i=>i.delivery_days_max))]);
   for(const item of g.items)if(item.stock_mode==='quantity')
    await c.query('INSERT INTO supplier_stock_reservations(group_id,variant_id,quantity) VALUES($1,$2,$3) ON CONFLICT(group_id,variant_id) DO UPDATE SET quantity=supplier_stock_reservations.quantity+excluded.quantity',[r.rows[0].id,item.variant_id,item.qty]);
  }
 });
 const created=await createCheckout(batch,u);
 return ok({checkout_id:batch,checkout_url:created.checkout_url,group_count:list.length,provider:'infinitepay',mode:'real_disabled_by_default'},201);
 }catch(e){return fail(e)}}
