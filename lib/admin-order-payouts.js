import QRCode from 'qrcode';
import {sql} from '@/lib/db';
import {payoutPayload} from '@/lib/payout-pix.mjs';
// The payable amount is the immutable supplier amount stored for the paid group.
export async function orderPayouts(orderId){
 const {rows}=await sql(`SELECT g.id AS group_id,g.supplier_amount_cents,g.fulfillment_status,s.business_name,
 p.transfer_reference,p.paid_at AS transferred_at,pix.updated_at AS pix_updated_at,
 CASE WHEN g.fulfillment_status='awaiting_payout' AND o.status IN ('paid','processing','packing') AND p.group_id IS NULL THEN pix.pix_key END AS pix_key,
 CASE WHEN g.fulfillment_status='awaiting_payout' AND o.status IN ('paid','processing','packing') AND p.group_id IS NULL THEN pix.pix_type END AS pix_type,
 CASE WHEN g.fulfillment_status='awaiting_payout' AND o.status IN ('paid','processing','packing') AND p.group_id IS NULL THEN pix.holder_name END AS pix_holder_name,
 CASE WHEN g.fulfillment_status='awaiting_payout' AND o.status IN ('paid','processing','packing') AND p.group_id IS NULL THEN pix.pix_city END AS pix_city
 FROM supplier_order_groups g JOIN orders o ON o.id=g.order_id JOIN suppliers s ON s.id=g.supplier_id
 LEFT JOIN supplier_pix_accounts pix ON pix.supplier_id=g.supplier_id LEFT JOIN supplier_manual_payouts p ON p.group_id=g.id
 WHERE g.order_id=$1 AND g.payment_status='approved' AND o.payment_status='approved'
 AND EXISTS(SELECT 1 FROM payments pay WHERE pay.order_id=o.id AND pay.provider='infinitepay' AND pay.status='approved')
 ORDER BY g.id`,[orderId]);
 return Promise.all(rows.map(async row=>{
  const {pix_key,pix_type,pix_holder_name,pix_updated_at,pix_city,...rest}=row;
  if(!pix_key)return {...rest,pix_ready:false};
  let code=null,qr=null;
  try{code=payoutPayload(row,pix_city);qr=await QRCode.toDataURL(code,{errorCorrectionLevel:'M',margin:4,scale:6});}catch{/* Preserve existing manual registration; invalid BR Code is never shown. */}
  return {...rest,pix_ready:true,pix_key,pix_type,pix_holder_name,pix_updated_at,code,qr};
 }));
}
