import {sql,transaction} from '@/lib/db';import {ok,fail,ensure,HttpError,uuid} from '@/lib/http';import {sha256,verifyMPWebhook} from '@/lib/security';import {fetchMPOrder} from '@/lib/mercadopago';
import {supplierAccessToken,mpRequest} from '@/lib/marketplace';
import {reconcilePayment} from '@/lib/split-reconcile';
export const runtime='nodejs';export const dynamic='force-dynamic';
function numCents(s){if(!/^\d+(\.\d{1,2})?$/.test(String(s)))return -1;return Math.round(Number(s)*100)}
export async function POST(req){try{
 const url=new URL(req.url);const body=await req.json().catch(()=>({}));const dataId=url.searchParams.get('data.id')||body?.data?.id;const type=url.searchParams.get('type')||body.type;
 if(type==='payment'){
   const id=String(dataId||'');ensure(/^\d{5,30}$/.test(id),'Pagamento inválido.',400);
   const legit=verifyMPWebhook({secret:process.env.MP_WEBHOOK_SECRET,signature:req.headers.get('x-signature'),requestId:req.headers.get('x-request-id'),dataId:id});ensure(legit,'Assinatura inválida.',401);
   const groupId=url.searchParams.get('group'),sellerId=String(body.user_id||'');
   // O parâmetro group não aprova pagamentos: apenas identifica com qual token consultar a API oficial.
   // O pagamento retornado pela API ainda precisa casar com grupo, vendedor, valor e moeda.
   const r=uuid(groupId)?await sql(`SELECT g.supplier_id,mp.provider_user_id FROM supplier_order_groups g
     JOIN supplier_mp_connections mp ON mp.supplier_id=g.supplier_id WHERE g.id=$1`,[groupId]):
     await sql('SELECT supplier_id,provider_user_id FROM supplier_mp_connections WHERE provider_user_id=$1',[sellerId]);
   if(!r.rowCount)return ok({ignored:'unrelated_payment'});
   const expectedSeller=String(r.rows[0].provider_user_id);

   const live=process.env.MP_MODE==='production';ensure(body.live_mode===live,'Ambiente divergente.',403);
   const token=await supplierAccessToken(r.rows[0].supplier_id);const payment=await mpRequest('/v1/payments/'+encodeURIComponent(id),token);
   if(payment.live_mode!==undefined)ensure(payment.live_mode===live,'Pagamento de outro ambiente.',403);
   if(uuid(groupId))ensure(String(payment.external_reference)===groupId,'Grupo informado não corresponde ao pagamento.',403);
   const result=await reconcilePayment(payment,expectedSeller);return ok({accepted:true,...result});
 }
 if(type!=='order')return ok({ignored:'other_event'});
 if(process.env.MP_MODE!=='sandbox')return ok({ignored:'legacy_orders_disabled'});
 ensure(body.live_mode===false,'Notificação de ambiente de produção bloqueada.',403);
 const verified=verifyMPWebhook({secret:process.env.MP_WEBHOOK_SECRET,signature:req.headers.get('x-signature'),requestId:req.headers.get('x-request-id'),dataId});ensure(verified,'Assinatura do webhook inválida.',401);
 const evId=sha256(`${body.id||''}|${body.action||''}|${dataId}`);
 const r=await sql('INSERT INTO webhook_events(id,provider,resource_id,event_type,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET received_at=now() RETURNING status',[evId,'mercadopago',String(dataId),String(body.action||'order'),'received']);
 if(r.rows[0]?.status==='processed')return ok({ignored:'duplicate'});
 // Never trust webhook body or the client return URL as payment approval.
 const mp=await fetchMPOrder(String(dataId));ensure(mp.id===dataId,'ID da cobrança divergente.',403);
 const affected=await transaction(async c=>{
  const found=await c.query('SELECT p.id AS payment_id,p.order_id,o.*,p.environment FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.provider_order_id=$1 FOR UPDATE OF p,o',[dataId]);
  if(!found.rowCount)return null;const o=found.rows[0];
  if(mp.external_reference!==o.order_id)throw new HttpError(403,'Referência externa divergente.');
  if(mp.currency&&mp.currency!=='BRL')throw new HttpError(403,'Moeda inesperada.');
  if(numCents(mp.total_amount)!==o.total_cents)throw new HttpError(403,'Valor da cobrança divergente.');
  const approved=mp.status==='processed'&&numCents(mp.total_paid_amount)===o.total_cents;
  const refunded=['refunded','charged_back'].includes(mp.status)||mp.status_detail==='refunded';
  const rejected=['failed','cancelled','canceled','expired'].includes(mp.status);
  const status=approved?'approved':refunded?'refunded':rejected?'rejected':'pending';
  await c.query('UPDATE payments SET status=$1,payment_method=$2,raw_summary=$3,updated_at=now() WHERE id=$4',[status,mp.transactions?.payments?.[0]?.payment_method?.id||null,JSON.stringify({id:mp.id,status:mp.status,total_amount:mp.total_amount,total_paid_amount:mp.total_paid_amount}),o.payment_id]);
  if(approved&&o.payment_status!=='approved'&&o.payment_status!=='refunded'){
    await c.query("UPDATE orders SET status='paid',payment_status='approved',paid_at=now(),updated_at=now() WHERE id=$1",[o.order_id]);
    await c.query('INSERT INTO order_status_history(order_id,from_status,to_status,note) VALUES($1,$2,$3,$4)',[o.order_id,o.status,'paid','Confirmação aprovada pelo servidor após consultar Orders API.']);
    if(o.coupon_id){const cr=await c.query('INSERT INTO coupon_redemptions(coupon_id,order_id,user_id,discount_cents) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO NOTHING RETURNING id',[o.coupon_id,o.order_id,o.customer_id,o.discount_cents]);if(cr.rowCount)await c.query('UPDATE coupons SET used_count=used_count+1 WHERE id=$1',[o.coupon_id]);}
    const orderItems=await c.query('SELECT sku_snapshot,product_name_snapshot,variant_snapshot,size_snapshot,quantity,unit_price_cents,line_total_cents FROM order_items WHERE order_id=$1',[o.order_id]);
    const customer=await c.query('SELECT full_name FROM users WHERE id=$1',[o.customer_id]);
    const payload={order_id:o.order_id,order_number:o.order_number,customer:customer.rows[0]?.full_name,items:orderItems.rows,subtotal_cents:o.subtotal_cents,discount_cents:o.discount_cents,coupon:o.coupon_code_snapshot,shipping_cents:o.shipping_cents,total_cents:o.total_cents,payment_method:mp.transactions?.payments?.[0]?.payment_method?.id||null,address:o.recipient_snapshot};
    await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',[o.order_id,'paid','Novo pedido pago!',JSON.stringify(payload)]);
    return 'paid';
  }
  if(refunded&&o.payment_status!=='refunded'){await c.query("UPDATE orders SET status='refunded',payment_status='refunded',updated_at=now() WHERE id=$1",[o.order_id]);await c.query('INSERT INTO order_status_history(order_id,from_status,to_status,note) VALUES($1,$2,$3,$4)',[o.order_id,o.status,'refunded','Reembolso confirmado pelo provedor.']);return 'refunded'}
  if(rejected&&o.payment_status==='pending'){await c.query("UPDATE orders SET payment_status='rejected',status='payment_failed',updated_at=now() WHERE id=$1",[o.order_id]);return 'rejected'}
  return 'no_change';
 });
 await sql("UPDATE webhook_events SET status='processed',processed_at=now(),error_message=null WHERE id=$1",[evId]);return ok({accepted:true,result:affected});
 }catch(e){return fail(e)}}
