import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {fail,ensure,uuid} from '@/lib/http';
import {identityFromRows,IDENTITY_FIELDS} from '@/lib/store-identity.mjs';
import {createShippingLabel} from '@/lib/shipping-label.mjs';import {validRecipient} from '@/lib/address-recipient.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req){try{
 const u=await requireRole(req,['admin','super_admin','supplier']),q=new URL(req.url).searchParams,groupId=q.get('group_id'),format=q.get('format')||'thermal';
 ensure(uuid(groupId)&&['thermal','a4'].includes(format),'Etiqueta inválida.');
 const r=await sql(`SELECT g.id,g.fulfillment_status,g.paid_at,g.created_at,g.carrier,g.tracking_code,o.order_number,o.recipient_snapshot,u.full_name AS customer_name
 FROM supplier_order_groups g JOIN orders o ON o.id=g.order_id JOIN suppliers s ON s.id=g.supplier_id JOIN users u ON u.id=o.customer_id
 WHERE g.id=$1 AND g.payment_status='approved' AND o.payment_status='approved'
 AND g.fulfillment_status IN ('awaiting_payout','paid','preparing','shipped','delivered')
 AND o.status NOT IN ('canceled','cancel_requested','refunded','return_requested')
 AND EXISTS(SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.provider='infinitepay' AND p.status='approved')
 AND ($2::boolean OR (s.user_id=$3 AND s.status='active' AND s.launch_archived_at IS NULL AND g.fulfillment_status IN ('paid','preparing','shipped','delivered')))`,[groupId,u.role!=='supplier',u.id]);
 ensure(r.rowCount,'Etiqueta não encontrada.',404);
 const [items,settings]=await Promise.all([sql('SELECT si.quantity,si.size_snapshot,si.sku_snapshot,i.product_name_snapshot,i.variant_snapshot FROM supplier_order_items si JOIN order_items i ON i.id=si.order_item_id WHERE si.group_id=$1 ORDER BY i.id',[groupId]),sql('SELECT key,value FROM store_settings WHERE key=ANY($1::text[]) AND sensitive=false',[IDENTITY_FIELDS])]);
 const group=r.rows[0];const snapshot=group.recipient_snapshot||{};if(!validRecipient(snapshot.recipient)&&validRecipient(group.customer_name))group.recipient_snapshot={...snapshot,recipient:group.customer_name};const data=await createShippingLabel({group,items:items.rows,identity:identityFromRows(settings.rows),format});
 return new Response(data,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="vellor-etiqueta-'+groupId+'.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return fail(e)}}
