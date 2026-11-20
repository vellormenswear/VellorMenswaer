import {transaction,sql} from '@/lib/db';
import {HttpError,ensure} from '@/lib/http';
import {supplierAccessToken,mpRequest,releaseReservations,syncOrderPayment} from '@/lib/marketplace';
import {paidStatus} from '@/lib/supplier-checkout.mjs';
export function toCents(value){if(value===null||value===undefined||!/^-?\d+(\.\d{1,2})?$/.test(String(value)))return -1;return Math.round(Number(value)*100)}
export async function reconcilePayment(payment,providerUserId){
 const id=String(payment.id||''),groupId=String(payment.external_reference||'');
 ensure(/^\d+$/.test(id)&&/^[0-9a-f-]{36}$/i.test(groupId),'Referência inválida.',403);
 const r=await sql(`SELECT g.*,s.status AS supplier_status,mp.provider_user_id FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id
 JOIN supplier_mp_connections mp ON mp.supplier_id=s.id WHERE g.id=$1`,[groupId]);
 if(!r.rowCount)return {ignored:'unrelated'};const g=r.rows[0];
 ensure(String(g.provider_user_id)===String(providerUserId),'Conta de recebimento divergente.',403);
 if(payment.collector_id!==undefined)ensure(String(payment.collector_id)===String(providerUserId),'Recebedor do pagamento divergente.',403);
 ensure(toCents(payment.transaction_amount)===g.amount_cents,'Valor do pagamento divergente.',403);
 ensure((payment.currency_id||'BRL')==='BRL','Moeda divergente.',403);
 if(payment.marketplace_fee!==null&&payment.marketplace_fee!==undefined)ensure(toCents(payment.marketplace_fee)===g.marketplace_fee_cents,'Comissão divergente.',403);
 const status=payment.status;
 const fee=Array.isArray(payment.fee_details)?Math.max(0,payment.fee_details.filter(x=>x.type!=='application_fee').reduce((n,x)=>n+Math.max(0,toCents(x.amount)),0)):null;
 return transaction(async c=>{
  const rows=await c.query('SELECT * FROM supplier_order_groups WHERE id=$1 FOR UPDATE',[groupId]);const before=rows.rows[0];
  ensure(before,'Pagamento desconhecido.',404);
  if(before.provider_payment_id&&before.provider_payment_id!==id&&['approved','refunded','refund_pending','refund_failed'].includes(before.payment_status))
   throw new HttpError(409,'Outro pagamento já confirmado para este grupo; necessária conciliação manual.');
  if(paidStatus(payment)){
   if(before.payment_status==='refunded')return {ignored:'refunded'};
   let orderId=before.order_id;
   let stockOk=true;
   if(!orderId){
    // Nenhuma linha é inserida em orders antes de um pagamento aprovado e verificado na API do Mercado Pago.
    ensure(before.checkout_batch_id&&before.customer_id&&before.recipient_snapshot&&Array.isArray(before.items_snapshot),'Intenção de pagamento incompleta.',409);
    const items=before.items_snapshot;
    ensure(items.length>0&&items.length<=30,'Itens inválidos.',409);
    const quantities=new Map();
    for(const item of items)if(item.stock_mode==='quantity')quantities.set(item.variant_id,(quantities.get(item.variant_id)||0)+item.qty);
    const ids=[...quantities.keys()].sort();
    if(ids.length){
     const rs=await c.query('SELECT id,stock,stock_mode FROM product_variants WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
     const variants=new Map(rs.rows.map(x=>[x.id,x]));
     stockOk=ids.every(variantId=>(variants.get(variantId)?.stock??-1)>=quantities.get(variantId));
    }
    const result=await c.query(`INSERT INTO orders(customer_id,recipient_snapshot,status,payment_status,subtotal_cents,discount_cents,shipping_cents,total_cents,coupon_id,coupon_code_snapshot,paid_at)
      VALUES($1,$2,$3,'approved',$4,$5,0,$6,$7,$8,now()) RETURNING id,order_number`,
      [before.customer_id,JSON.stringify(before.recipient_snapshot),stockOk?'paid':'cancel_requested',before.subtotal_cents,before.discount_cents,before.amount_cents,before.coupon_id,before.coupon_code_snapshot]);
    const order=result.rows[0];orderId=order.id;
    for(const item of items){
     const ins=await c.query(`INSERT INTO order_items(order_id,variant_id,sku_snapshot,product_name_snapshot,variant_snapshot,size_snapshot,image_url_snapshot,quantity,unit_price_cents,line_total_cents)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [orderId,item.variant_id,item.sku,item.name,item.variant,item.size,item.image,item.qty,item.unit_cents,item.line_cents]);
     await c.query(`INSERT INTO supplier_order_items(group_id,order_item_id,variant_id,sku_snapshot,size_snapshot,quantity,unit_cost_cents,supplier_line_cents)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[groupId,ins.rows[0].id,item.variant_id,item.sku,item.size,item.qty,item.cost_cents,item.qty*item.cost_cents]);
    }
    if(stockOk){
     for(const [variantId,quantity] of quantities){
      const debit=await c.query(`UPDATE product_variants SET stock=stock-$1,updated_at=now() WHERE id=$2 AND stock_mode='quantity' AND stock>=$1 RETURNING id`,[quantity,variantId]);
      ensure(debit.rowCount,'Falha concorrente na reserva de estoque.',409);
     }
     await c.query("UPDATE supplier_stock_reservations SET status='committed',updated_at=now() WHERE group_id=$1 AND status='held'",[groupId]);
    }else{
     await c.query("UPDATE supplier_stock_reservations SET status='released',updated_at=now() WHERE group_id=$1 AND status='held'",[groupId]);
    }
    await c.query('UPDATE supplier_order_groups SET order_id=$1 WHERE id=$2',[orderId,groupId]);
    await c.query('INSERT INTO order_status_history(order_id,from_status,to_status,note) VALUES($1,$2,$3,$4)',[orderId,null,stockOk?'paid':'cancel_requested',stockOk?'Pagamento validado no Mercado Pago. Pedido criado após aprovação.':'Pagamento aprovado, mas estoque indisponível. Não enviar; providenciar reembolso.']);
    if(before.coupon_id){
     const coupon=await c.query(`INSERT INTO checkout_coupon_redemptions(checkout_batch_id,coupon_id,order_id) VALUES($1,$2,$3)
       ON CONFLICT(checkout_batch_id) DO NOTHING RETURNING checkout_batch_id`,[before.checkout_batch_id,before.coupon_id,orderId]);
     if(coupon.rowCount)await c.query('UPDATE coupons SET used_count=used_count+1 WHERE id=$1',[before.coupon_id]);
    }
    await c.query(`INSERT INTO payments(order_id,provider,provider_order_id,status,payment_method,amount_cents,environment,raw_summary)
      VALUES($1,'mercadopago',$2,'approved',$3,$4,$5,$6) ON CONFLICT(provider_order_id) DO NOTHING`,
      [orderId,'MP-PAY-'+id,payment.payment_method_id||null,before.amount_cents,process.env.MP_MODE||'sandbox',JSON.stringify({payment_id:id,status:payment.status,collector_id:payment.collector_id})]);
    await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',[orderId,stockOk?'supplier_paid':'supplier_refund_required',stockOk?'Novo pedido pago!':'Pagamento recebido: ação de reembolso necessária',JSON.stringify({group_id:groupId,supplier_id:before.supplier_id,payment_id:id,stock_ok:stockOk})]);
   }
   const nextStatus=before.payment_status==='refund_pending'||!stockOk?'refund_pending':'approved';
   await c.query(`UPDATE supplier_order_groups SET payment_status=$1,fulfillment_status=CASE WHEN $2=false THEN 'cancel_requested'
        WHEN fulfillment_status IN ('cancel_requested','canceled') THEN fulfillment_status ELSE 'paid' END,
        provider_payment_id=$3,mp_fee_cents=COALESCE($4,mp_fee_cents),paid_at=COALESCE(paid_at,now()),updated_at=now() WHERE id=$5`,[nextStatus,stockOk,id,fee,groupId]);
   await syncOrderPayment(c,orderId);
   return {group_id:groupId,status:'approved',order_id:orderId,created:!before.order_id,requires_refund:!stockOk};
  }
  if(status==='refunded'||status==='charged_back'){
   if(before.payment_status==='refunded')return {ignored:'already_refunded'};
   await c.query("UPDATE supplier_order_groups SET payment_status='refunded',fulfillment_status=CASE WHEN fulfillment_status IN ('shipped','delivered') THEN fulfillment_status ELSE 'canceled' END,provider_payment_id=$1,refunded_at=now(),updated_at=now() WHERE id=$2",[id,groupId]);
   if(before.order_id){
    if(!['shipped','delivered'].includes(before.fulfillment_status))await releaseReservations(c,groupId);
    await c.query("UPDATE orders SET status='refunded',payment_status='refunded',updated_at=now() WHERE id=$1",[before.order_id]);
    await c.query("UPDATE payments SET status='refunded',updated_at=now() WHERE provider_order_id=$1",['MP-PAY-'+id]);
    await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',[before.order_id,'supplier_refunded','Reembolso confirmado',JSON.stringify({group_id:groupId,supplier_id:before.supplier_id})]);
   }else await releaseReservations(c,groupId);
  }else if(['rejected','cancelled','expired'].includes(status)){
   if(['approved','refunded','refund_pending','refund_failed'].includes(before.payment_status))return {ignored:'already_paid'};
   await c.query('UPDATE supplier_order_groups SET provider_payment_id=$1,updated_at=now() WHERE id=$2',[id,groupId]);
   // A preferência pode receber outra tentativa: reservar estoque até a data de expiração.
  }else if(before.provider_payment_id!==id){
   await c.query('UPDATE supplier_order_groups SET provider_payment_id=$1,updated_at=now() WHERE id=$2',[id,groupId]);
  }
  if(before.order_id)await syncOrderPayment(c,before.order_id);
  return {group_id:groupId,status};
 });
}
export async function fetchAndReconcile(group,paymentId){const tok=await supplierAccessToken(group.supplier_id);const mp=await mpRequest('/v1/payments/'+encodeURIComponent(paymentId),tok);return reconcilePayment(mp,group.provider_user_id)}
