import {ensure} from '@/lib/http';
import {transaction} from '@/lib/db';
export const cancelableStatuses=['awaiting_payment','payment_failed','paid','processing','packing','cancel_requested'];
const insertNotice=(c,id,kind,title,payload)=>c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',[id,kind,title,JSON.stringify(payload)]);
const history=(c,id,from,to,actor,note)=>c.query('INSERT INTO order_status_history(order_id,from_status,to_status,actor_id,note) VALUES($1,$2,$3,$4,$5)',[id,from,to,actor,note]);
const audit=(c,actor,action,id,payload)=>c.query('INSERT INTO audit_logs(actor_id,action,resource_type,resource_id,after_data) VALUES($1,$2,\'order\',$3,$4)',[actor,action,id,JSON.stringify(payload)]);
export async function cancelAdminOrder({id,actor,reason}){
 return transaction(async c=>{
  const batches=(await c.query('SELECT DISTINCT checkout_batch_id FROM supplier_order_groups WHERE order_id=$1 AND checkout_batch_id IS NOT NULL ORDER BY checkout_batch_id',[id])).rows;
  for(const b of batches)await c.query('SELECT checkout_batch_id FROM infinitepay_checkout_batches WHERE checkout_batch_id=$1 FOR UPDATE',[b.checkout_batch_id]);
  const order=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
  ensure(order,'Pedido não encontrado.',404);
  if(order.status==='canceled')return {canceled:true,refund_pending:order.payment_status==='approved',duplicate:true};
  ensure(cancelableStatuses.includes(order.status),'Pedido já enviado, entregue ou encerrado. Utilize o fluxo de devolução.',409);
  ensure(['approved','rejected','pending'].includes(order.payment_status),'Pagamento exige análise financeira.',409);
  const groups=(await c.query('SELECT * FROM supplier_order_groups WHERE order_id=$1 ORDER BY id FOR UPDATE',[id])).rows;
  ensure(!groups.some(g=>g.posted_at||['shipped','delivered'].includes(g.fulfillment_status)),'Pedido já postado. Utilize o fluxo de devolução.',409);
  ensure(!groups.some(g=>g.payment_status==='refunded'),'Pedido já possui reembolso; revise a conciliação.',409);
  const paid=order.payment_status==='approved';
  if(!paid)ensure(order.payment_status==='rejected'&&!groups.some(g=>['pending','approved','refund_pending'].includes(g.payment_status)),'Não cancele uma cobrança ainda em aberto; confirme primeiro o encerramento no provedor.',409);
  await c.query("UPDATE orders SET status='canceled',updated_at=now() WHERE id=$1",[id]);
  for(const g of groups){
   await c.query("UPDATE supplier_order_groups SET fulfillment_status='canceled',payment_status=CASE WHEN payment_status IN ('approved','refund_pending','refund_failed') THEN 'refund_pending' ELSE payment_status END,canceled_reason=$2,updated_at=now() WHERE id=$1",[g.id,reason]);
   // Devolução de estoque apenas para reservas efetivamente debitadas, antes da postagem.
   const reservations=(await c.query("UPDATE supplier_stock_reservations SET status='released',updated_at=now() WHERE group_id=$1 AND status='committed' RETURNING variant_id,quantity",[g.id])).rows;
   for(const r of reservations)await c.query("UPDATE product_variants SET stock=stock+$1,updated_at=now() WHERE id=$2 AND stock_mode='quantity' AND stock IS NOT NULL",[r.quantity,r.variant_id]);
   await c.query("UPDATE supplier_stock_reservations SET status='released',updated_at=now() WHERE group_id=$1 AND status='held'",[g.id]);
  }
  await history(c,id,order.status,'canceled',actor,reason);
  await insertNotice(c,id,'customer_order_canceled','Pedido cancelado',{order_number:order.order_number,amount_cents:order.total_cents,refund_pending:paid});
  await c.query("WITH changed AS (UPDATE customer_requests SET status=$2,admin_note=$3,resolved_at=CASE WHEN $2='resolved' THEN now() ELSE NULL END WHERE order_id=$1 AND type='cancel' AND status IN ('open','under_review','approved') RETURNING id) INSERT INTO customer_request_messages(request_id,sender_kind,body) SELECT id,'admin',$3 FROM changed",[id,paid?'approved':'resolved',paid?'Cancelamento concluído. Reembolso pendente.':'Cancelamento concluído sem pagamento confirmado.']);
  await audit(c,actor,'order.admin_canceled',id,{reason,refund_pending:paid});
  return {canceled:true,refund_pending:paid};
 });
}
export async function confirmAdminRefund({id,actor,reference,amount,confirmed}){
 ensure(confirmed===true,'Confirme que verificou o comprovante oficial e o meio de pagamento original.',400);
 ensure(typeof reference==='string'&&reference.length>=8&&reference.length<=150,'Informe a referência do comprovante de estorno.',400);
 ensure(Number.isSafeInteger(amount)&&amount>0,'Valor do estorno inválido.',400);
 return transaction(async c=>{
  const lookup=(await c.query("SELECT g.checkout_batch_id FROM supplier_order_groups g JOIN infinitepay_checkout_batches b ON b.checkout_batch_id=g.checkout_batch_id WHERE g.order_id=$1",[id])).rows;
  ensure(lookup.length===1,'Pagamento não identificado como InfinitePay; concilie no provedor original.',409);
  const batch=(await c.query('SELECT * FROM infinitepay_checkout_batches WHERE checkout_batch_id=$1 FOR UPDATE',[lookup[0].checkout_batch_id])).rows[0];
  ensure(batch&&batch.status==='approved','Checkout indisponível para conciliação.',409);
  const gs=(await c.query('SELECT * FROM supplier_order_groups WHERE checkout_batch_id=$1 ORDER BY id FOR UPDATE',[batch.checkout_batch_id])).rows;
  const target=gs.find(g=>g.order_id===id);
  ensure(target,'Pedido não encontrado no checkout.',404);
  ensure(['pix','credit_card'].includes(batch.payment_method),'Forma de pagamento não reconhecida.',409);
  // Pix permite devolução por pedido; cartão com vários pedidos exige confirmação integral.
  const selected=batch.payment_method==='credit_card'?gs:[target];
  ensure(selected.every(g=>g.order_id&&g.fulfillment_status==='canceled'&&g.payment_status==='refund_pending'),'Cancele os pedidos correspondentes antes de confirmar o estorno. No cartão, todos os pedidos da mesma cobrança devem estar cancelados.',409);
  ensure(selected.reduce((sum,g)=>sum+Number(g.amount_cents),0)===amount,'Valor informado difere do total dos pedidos cancelados.',409);
  const ids=selected.map(g=>g.order_id).sort();
  const orders=(await c.query('SELECT * FROM orders WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids])).rows;
  ensure(orders.length===ids.length&&orders.every(o=>o.status==='canceled'&&o.payment_status==='approved'),'Pedido não está cancelado com pagamento pendente de estorno.',409);
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['vellor-refund:'+reference]);
  const duplicate=await c.query("SELECT 1 FROM payments WHERE provider='infinitepay' AND raw_summary->>'refund_reference'=$1 LIMIT 1",[reference]);
  ensure(!duplicate.rowCount,'Comprovante já utilizado em outro estorno.',409);
  for(const g of selected){
   const o=orders.find(o=>o.id===g.order_id);
   ensure(o.total_cents===g.amount_cents,'Total do pedido divergente.',409);
   const p=await c.query("UPDATE payments SET status='refunded',raw_summary=raw_summary||$2::jsonb,updated_at=now() WHERE order_id=$1 AND provider='infinitepay' AND status='approved' AND amount_cents=$3 RETURNING id",[o.id,JSON.stringify({refund_reference:reference,refund_confirmed_by:actor,refund_confirmation:'manual_provider_receipt',refund_amount_cents:g.amount_cents}),g.amount_cents]);
   ensure(p.rowCount===1,'Pagamento não localizado ou já conciliado.',409);
   await c.query("UPDATE orders SET payment_status='refunded',updated_at=now() WHERE id=$1",[o.id]);
   await c.query("UPDATE supplier_order_groups SET payment_status='refunded',refunded_at=now(),updated_at=now() WHERE id=$1",[g.id]);
   const payout=(await c.query('SELECT amount_cents FROM supplier_manual_payouts WHERE group_id=$1',[g.id])).rows[0];
   if(payout)await insertNotice(c,o.id,'supplier_refund_recovery_required','Recuperar repasse Pix de pedido estornado',{group_id:g.id,order_number:o.order_number,amount_cents:payout.amount_cents});
   await history(c,o.id,'canceled','canceled',actor,'Estorno confirmado por comprovante oficial da InfinitePay.');
   await insertNotice(c,o.id,'customer_order_refunded','Estorno confirmado',{order_number:o.order_number,amount_cents:g.amount_cents});
   await c.query("WITH changed AS (UPDATE customer_requests SET status='resolved',admin_note='Reembolso confirmado.',resolved_at=now() WHERE order_id=$1 AND type='cancel' AND status IN ('open','under_review','approved') RETURNING id) INSERT INTO customer_request_messages(request_id,sender_kind,body) SELECT id,'admin','Reembolso confirmado.' FROM changed",[o.id]);
   await audit(c,actor,'order.refund_confirmed',o.id,{reference,amount_cents:g.amount_cents,source:'manual_provider_receipt'});
  }
  if(gs.every(g=>g.payment_status==='refunded'||selected.some(s=>s.id===g.id)))await c.query("UPDATE infinitepay_checkout_batches SET status='refunded',updated_at=now() WHERE checkout_batch_id=$1",[batch.checkout_batch_id]);
  return {refunded:true,amount_cents:amount,order_count:ids.length};
 });
}
