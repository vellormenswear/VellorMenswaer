import {transaction,sql} from '@/lib/db';
import {HttpError,ensure} from '@/lib/http';
import {supplierAccessToken,mpRequest,releaseReservations,syncOrderPayment} from '@/lib/marketplace';
export function toCents(value){if(value===null||value===undefined||!/^-?\d+(\.\d{1,2})?$/.test(String(value)))return -1;return Math.round(Number(value)*100)}
export async function reconcilePayment(payment,providerUserId){
 const id=String(payment.id||'');const groupId=String(payment.external_reference||'');
 ensure(/^[0-9]+$/.test(id)&&/^[0-9a-f-]{36}$/i.test(groupId),'Referência inválida.',403);
 const r=await sql(`SELECT g.*,s.status,mp.provider_user_id FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id JOIN supplier_mp_connections mp ON mp.supplier_id=s.id WHERE g.id=$1`,[groupId]);
 if(!r.rowCount)return {ignored:'unrelated'};const g=r.rows[0];
 ensure(String(g.provider_user_id)===String(providerUserId),'Conta do recebimento divergente.',403);
 ensure(toCents(payment.transaction_amount)===g.amount_cents,'Valor divergente do pedido.',403);
 ensure((payment.currency_id||'BRL')==='BRL','Moeda divergente.',403);
 ensure(!payment.marketplace_fee||toCents(payment.marketplace_fee)===g.marketplace_fee_cents,'Comissão divergente.',403);
 const status=payment.status;
 const fee=Array.isArray(payment.fee_details)?Math.max(0,payment.fee_details.filter(x=>x.type!=='application_fee').reduce((n,x)=>n+Math.max(0,toCents(x.amount)),0)):null;
 return transaction(async c=>{
  const z=await c.query('SELECT * FROM supplier_order_groups WHERE id=$1 FOR UPDATE',[groupId]);const before=z.rows[0];
  if(before.provider_payment_id&&before.provider_payment_id!==id&&['approved','refunded','refund_pending','refund_failed'].includes(before.payment_status))throw new HttpError(409,'Grupo já associado a um pagamento confirmado. Solicite conciliação manual.');
  if(status==='approved'){
   if(before.payment_status==='refunded')return {ignored:'refunded'};
   // Reembolso iniciado pode correr em paralelo com confirmação; não reabrir expedição.
   const wasPaid=before.payment_status==='approved';
   await c.query(`UPDATE supplier_order_groups SET payment_status=CASE WHEN payment_status='refund_pending' THEN payment_status ELSE 'approved' END,fulfillment_status=CASE WHEN fulfillment_status IN ('cancel_requested','canceled') THEN fulfillment_status WHEN fulfillment_status='awaiting_payment' THEN 'paid' ELSE fulfillment_status END,provider_payment_id=$1,mp_fee_cents=COALESCE($2,mp_fee_cents),paid_at=COALESCE(paid_at,now()),updated_at=now() WHERE id=$3`,[id,fee,groupId]);
   await c.query("UPDATE supplier_stock_reservations SET status='committed',updated_at=now() WHERE group_id=$1 AND status='held'",[groupId]);
   if(!wasPaid){await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',[g.order_id,'supplier_paid','Pedido de fornecedor pago',JSON.stringify({group_id:groupId,supplier_id:g.supplier_id})]);}
  }else if(status==='refunded'||status==='charged_back'){
   if(before.payment_status==='refunded')return {ignored:'already_refunded'};
   await c.query("UPDATE supplier_order_groups SET payment_status='refunded',fulfillment_status=CASE WHEN fulfillment_status IN ('shipped','delivered') THEN fulfillment_status ELSE 'canceled' END,provider_payment_id=$1,refunded_at=now(),updated_at=now() WHERE id=$2",[id,groupId]);
   if(!['shipped','delivered'].includes(before.fulfillment_status))await releaseReservations(c,groupId);
   await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',[g.order_id,'supplier_refunded','Reembolso de fornecedor confirmado',JSON.stringify({group_id:groupId,supplier_id:g.supplier_id})]);
  }else if(['rejected','cancelled','expired'].includes(status)){
   if(['approved','refunded','refund_pending','refund_failed'].includes(before.payment_status))return {ignored:'already_paid'};
   // Uma tentativa rejeitada pode ser refeita na mesma preferência: não liberamos estoque sem conciliação segura.
   await c.query('UPDATE supplier_order_groups SET provider_payment_id=$1,updated_at=now() WHERE id=$2',[id,groupId]);
  }else{
   if(before.provider_payment_id!==id)await c.query('UPDATE supplier_order_groups SET provider_payment_id=$1,updated_at=now() WHERE id=$2',[id,groupId]);
  }
  await syncOrderPayment(c,g.order_id);return {group_id:groupId,status};
 });
}
export async function fetchAndReconcile(group,paymentId){const tok=await supplierAccessToken(group.supplier_id);const mp=await mpRequest('/v1/payments/'+encodeURIComponent(paymentId),tok);return reconcilePayment(mp,group.provider_user_id)}
