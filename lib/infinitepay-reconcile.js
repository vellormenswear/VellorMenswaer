import {sql,transaction} from '@/lib/db';
import {ensure} from '@/lib/http';
import {infinitepayApi} from '@/lib/infinitepay-api';
import {verifiedInfinitepayPayment,safeInfiniteRef} from '@/lib/infinitepay.mjs';
const moneyCents=n=>Math.round(Number(n)*100);

export async function reconcileInfinitepayBatch(batchId,refs){
 const r=await sql('SELECT * FROM infinitepay_checkout_batches WHERE checkout_batch_id=$1',[batchId]);
 ensure(r.rowCount===1,'Checkout nao encontrado.',404);
 const batch=r.rows[0];
 if(batch.status==='approved')return {result:'ALREADY_APPROVED',confirmed:true};
 if(batch.status==='failed')return {result:'CHECKOUT_FAILED',confirmed:false};
 const transaction=String(refs?.transaction_nsu||batch.transaction_nsu||'');
 const slug=String(refs?.invoice_slug||batch.invoice_slug||'');
 ensure(safeInfiniteRef(transaction)&&safeInfiniteRef(slug),'Referencias InfinitePay invalidas.',400);
 if(batch.transaction_nsu&&batch.transaction_nsu!==transaction)return {result:'TRANSACTION_MISMATCH',confirmed:false};
 if(batch.invoice_slug&&batch.invoice_slug!==slug)return {result:'INVOICE_MISMATCH',confirmed:false};
 const paid=await infinitepayApi('/payment_check',{handle:process.env.INFINITEPAY_HANDLE,order_nsu:batch.order_nsu,transaction_nsu:transaction,slug});
 if(!verifiedInfinitepayPayment(paid,batch.total_cents))return {result:'AWAITING_PAYMENT',confirmed:false};
 const paidId=transaction;
 return transaction(async c=>{
  const current=(await c.query('SELECT * FROM infinitepay_checkout_batches WHERE checkout_batch_id=$1 FOR UPDATE',[batchId])).rows[0];
  ensure(current,'Checkout nao encontrado.',404);
  if(current.status==='approved')return {result:'ALREADY_APPROVED',confirmed:true};
  ensure(current.status==='pending','Checkout encerrado.',409);
  ensure(!current.transaction_nsu||current.transaction_nsu===paidId,'Transacao divergente.',409);
  ensure(!current.invoice_slug||current.invoice_slug===slug,'Fatura divergente.',409);
  const groups=(await c.query('SELECT * FROM supplier_order_groups WHERE checkout_batch_id=$1 ORDER BY id FOR UPDATE',[batchId])).rows;
  ensure(groups.length>0&&groups.every(g=>g.payment_status==='pending'&&!g.order_id),'Grupos de pagamento inconsistentes.',409);
  ensure(groups.reduce((s,g)=>s+g.amount_cents,0)===current.total_cents,'Total divergente no banco.',409);
  const quantities=new Map();
  for(const g of groups){
   ensure(Array.isArray(g.items_snapshot)&&g.items_snapshot.length>0,'Pedido sem itens.',409);
   for(const item of g.items_snapshot)if(item.stock_mode==='quantity')
    quantities.set(item.variant_id,(quantities.get(item.variant_id)||0)+item.qty);
  }
  const ids=[...quantities.keys()].sort();
  const variants=ids.length?(await c.query('SELECT id,stock FROM product_variants WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids])).rows:[];
  const inventory=new Map(variants.map(v=>[v.id,v.stock]));
  const stockOk=ids.every(id=>(inventory.get(id)??-1)>=quantities.get(id));
  const orderIds=[];
  for(const g of groups){
   const inserted=await c.query("INSERT INTO orders(customer_id,recipient_snapshot,status,payment_status,subtotal_cents,discount_cents,shipping_cents,total_cents,coupon_id,coupon_code_snapshot,paid_at) VALUES($1,$2,$3,'approved',$4,$5,0,$6,$7,$8,now()) RETURNING id,order_number",
    [g.customer_id,JSON.stringify(g.recipient_snapshot),stockOk?'awaiting_payout':'cancel_requested',g.subtotal_cents,g.discount_cents,g.amount_cents,g.coupon_id,g.coupon_code_snapshot]);
   const order=inserted.rows[0];
   orderIds.push(order.id);
   for(const item of g.items_snapshot){
    const line=await c.query("INSERT INTO order_items(order_id,variant_id,sku_snapshot,product_name_snapshot,variant_snapshot,size_snapshot,image_url_snapshot,quantity,unit_price_cents,line_total_cents) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
     [order.id,item.variant_id,item.sku,item.name,item.variant,item.size,item.image,item.qty,item.unit_cents,item.line_cents]);
    await c.query("INSERT INTO supplier_order_items(group_id,order_item_id,variant_id,sku_snapshot,size_snapshot,quantity,unit_cost_cents,supplier_line_cents) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
     [g.id,line.rows[0].id,item.variant_id,item.sku,item.size,item.qty,item.cost_cents,item.qty*item.cost_cents]);
   }
   await c.query("UPDATE supplier_order_groups SET order_id=$1,payment_status=$2,fulfillment_status=$3,paid_at=now(),updated_at=now() WHERE id=$4",
    [order.id,stockOk?'approved':'refund_pending',stockOk?'awaiting_payout':'cancel_requested',g.id]);
   await c.query("INSERT INTO payments(order_id,provider,provider_order_id,status,payment_method,amount_cents,environment,raw_summary) VALUES($1,'infinitepay',$2,'approved',$3,$4,'production',$5) ON CONFLICT(provider_order_id) DO NOTHING",
    [order.id,'INFINITEPAY-'+paidId+'-'+g.id,paid.capture_method,g.amount_cents,JSON.stringify({order_nsu:batch.order_nsu,transaction_nsu:paidId,invoice_slug:slug,status:'paid',paid_amount:paid.paid_amount})]);
   await c.query('INSERT INTO order_status_history(order_id,from_status,to_status,note) VALUES($1,$2,$3,$4)',
    [order.id,null,stockOk?'awaiting_payout':'cancel_requested',stockOk?'Pagamento InfinitePay confirmado via payment_check; fornecedor aguarda Pix manual.':'Pagamento recebido; estoque indisponivel. Reembolso manual necessario.']);
   await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',[order.id,stockOk?'supplier_payment_pending':'supplier_refund_required',
    stockOk?'Pagamento aprovado: aguardar repasse Pix da VELLOR':'Pagamento recebido: reembolso necessario',JSON.stringify({group_id:g.id,supplier_id:g.supplier_id,checkout_id:batchId})]);
   if(g.coupon_id){
    const redemption=await c.query("INSERT INTO checkout_coupon_redemptions(checkout_batch_id,coupon_id,order_id) VALUES($1,$2,$3) ON CONFLICT(checkout_batch_id) DO NOTHING RETURNING checkout_batch_id",[batchId,g.coupon_id,order.id]);
    if(redemption.rowCount)await c.query('UPDATE coupons SET used_count=used_count+1 WHERE id=$1',[g.coupon_id]);
   }
  }
  if(stockOk){
   for(const [variantId,qty] of quantities){
    const debit=await c.query("UPDATE product_variants SET stock=stock-$1,updated_at=now() WHERE id=$2 AND stock_mode='quantity' AND stock>=$1 RETURNING id",[qty,variantId]);
    ensure(debit.rowCount,'Estoque alterado durante confirmacao.',409);
   }
   await c.query("UPDATE supplier_stock_reservations SET status='committed',updated_at=now() WHERE group_id=ANY($1::uuid[]) AND status='held'",[groups.map(g=>g.id)]);
  }else await c.query("UPDATE supplier_stock_reservations SET status='released',updated_at=now() WHERE group_id=ANY($1::uuid[]) AND status='held'",[groups.map(g=>g.id)]);
  await c.query("UPDATE infinitepay_checkout_batches SET status='approved',transaction_nsu=$1,invoice_slug=$2,payment_method=$3,paid_at=now(),updated_at=now() WHERE checkout_batch_id=$4",[paidId,slug,paid.capture_method,batchId]);
  return {result:stockOk?'APPROVED':'REFUND_REVIEW_REQUIRED',confirmed:true,requires_refund:!stockOk,order_count:orderIds.length};
 });
}

export async function expireInfinitepayBatch(batchId){
 return transaction(async c=>{
  const b=(await c.query('SELECT status FROM infinitepay_checkout_batches WHERE checkout_batch_id=$1 FOR UPDATE',[batchId])).rows[0];
  if(!b||b.status!=='pending')return false;
  await c.query("UPDATE infinitepay_checkout_batches SET status='failed',updated_at=now() WHERE checkout_batch_id=$1",[batchId]);
  const g=await c.query("UPDATE supplier_order_groups SET payment_status='rejected',updated_at=now() WHERE checkout_batch_id=$1 AND payment_status='pending' RETURNING id",[batchId]);
  if(g.rowCount)await c.query("UPDATE supplier_stock_reservations SET status='released',updated_at=now() WHERE group_id=ANY($1::uuid[]) AND status='held'",[g.rows.map(x=>x.id)]);
  return true;
 });
}
