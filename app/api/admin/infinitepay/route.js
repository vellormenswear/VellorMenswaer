import {sql,transaction,audit} from '@/lib/db';
import {requireRole} from '@/lib/auth';
import {ok,fail,ensure,body,originGuard,uuid,txt} from '@/lib/http';
import {infinitepayConfigured} from '@/lib/infinitepay.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req){try{
 await requireRole(req,['super_admin']);
 const groups=await sql(`SELECT g.id,g.supplier_id,g.order_id,g.amount_cents,g.supplier_amount_cents,g.payment_status,g.fulfillment_status,
 s.business_name,o.order_number,g.paid_at,p.transfer_reference,p.recorded_by,p.paid_at AS transferred_at
 FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id
 JOIN orders o ON o.id=g.order_id
 LEFT JOIN supplier_manual_payouts p ON p.group_id=g.id
 JOIN payments pay ON pay.order_id=o.id AND pay.provider='infinitepay' AND pay.status='approved'
 WHERE g.payment_status='approved' ORDER BY g.paid_at DESC LIMIT 200`);
 return ok({configured:infinitepayConfigured(process.env),checkout_enabled:process.env.INFINITEPAY_CHECKOUT_ENABLED==='true',
  handle_set:!!process.env.INFINITEPAY_HANDLE,groups:groups.rows});
 }catch(e){return fail(e)}}
export async function POST(req){try{
 originGuard(req);const u=await requireRole(req,['super_admin']);const x=await body(req,3000);
 ensure(x.action==='record_payout'&&uuid(x.group_id),'Operacao invalida.',400);
 const reference=txt(x.transfer_reference,150),note=txt(x.notes,500);
 ensure(/^[A-Za-z0-9][A-Za-z0-9 _./:-]{7,149}$/.test(reference),'Informe identificador do Pix realmente realizado.',400);
 ensure(note.length>=8,'Informe data, destinatario e referencia do comprovante.',400);
 const result=await transaction(async c=>{
  const r=await c.query("SELECT g.*,o.payment_status AS order_payment FROM supplier_order_groups g JOIN orders o ON o.id=g.order_id WHERE g.id=$1 FOR UPDATE OF g",[x.group_id]);
  ensure(r.rowCount,'Pedido de fornecedor nao encontrado.',404);const group=r.rows[0];
  ensure(group.payment_status==='approved'&&group.order_payment==='approved'&&group.fulfillment_status==='awaiting_payout',
   'Repasse indisponivel: pedido nao pago, ja registrado ou em disputa.',409);
  const payment=await c.query("SELECT 1 FROM payments WHERE order_id=$1 AND provider='infinitepay' AND status='approved'",[group.order_id]);
  ensure(payment.rowCount,'Pagamento InfinitePay nao validado.',409);
  const amount=Number(group.supplier_amount_cents);
  ensure(Number.isSafeInteger(amount)&&amount>0,'Valor do repasse invalido.',409);
  await c.query('INSERT INTO supplier_manual_payouts(group_id,supplier_id,amount_cents,transfer_reference,notes,recorded_by) VALUES($1,$2,$3,$4,$5,$6)',
   [group.id,group.supplier_id,amount,reference,note,u.id]);
  await c.query("UPDATE supplier_order_groups SET fulfillment_status='paid',updated_at=now() WHERE id=$1 AND fulfillment_status='awaiting_payout'",[group.id]);
  await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',
   [group.order_id,'supplier_paid','Repasse Pix ao fornecedor registrado',JSON.stringify({group_id:group.id,supplier_id:group.supplier_id})]);
  return {id:group.id,amount_cents:amount};
 });
 await audit(u.id,'supplier.pix_manual_recorded','supplier_group',x.group_id,null,{amount_cents:result.amount_cents,transfer_reference:reference});
 return ok({recorded:true,...result});
 }catch(e){return fail(e)}}
