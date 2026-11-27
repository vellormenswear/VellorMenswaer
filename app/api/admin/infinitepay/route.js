import {sql,db,transaction,audit,auditTx} from '@/lib/db';
import {applyMarketplaceMigrations} from '@/lib/marketplace-auto-schema.mjs';
import {requireRole} from '@/lib/auth';
import {ok,fail,ensure,body,originGuard,uuid,txt} from '@/lib/http';
import {infinitepayConfigured,safeInfiniteRef} from '@/lib/infinitepay.mjs';
import {reconcileInfinitepayBatch} from '@/lib/infinitepay-reconcile';
import {maskPixKey} from '@/lib/supplier-pix.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req){try{
 await requireRole(req,['super_admin']);
 await applyMarketplaceMigrations(()=>db().connect());
 const [groups,checkouts]=await Promise.all([sql(`SELECT g.id,g.supplier_id,g.order_id,g.amount_cents,g.supplier_amount_cents,g.payment_status,g.fulfillment_status,
 s.business_name,o.order_number,g.paid_at,p.transfer_reference,p.recorded_by,p.paid_at AS transferred_at,
 p.pix_key_suffix AS payout_pix_suffix,p.pix_holder_name AS payout_holder_name
 FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id
 JOIN orders o ON o.id=g.order_id
 LEFT JOIN supplier_manual_payouts p ON p.group_id=g.id
 WHERE g.payment_status='approved' AND EXISTS(SELECT 1 FROM payments pay WHERE pay.order_id=o.id AND pay.provider='infinitepay' AND pay.status='approved') ORDER BY g.paid_at DESC LIMIT 200`),sql("SELECT checkout_batch_id,order_nsu,total_cents,supplier_cents,status,created_at,paid_at FROM infinitepay_checkout_batches ORDER BY created_at DESC LIMIT 40")]);
 return ok({checkouts:checkouts.rows,configured:infinitepayConfigured(process.env),checkout_enabled:process.env.INFINITEPAY_CHECKOUT_ENABLED==='true',
  handle_set:!!process.env.INFINITEPAY_HANDLE,groups:groups.rows});
 }catch(e){return fail(e)}}
export async function POST(req){try{
 originGuard(req);const x=await body(req,3000);const u=await requireRole(req,x.action==='record_payout'?['admin','super_admin']:['super_admin']);
 if(x.action==='reconcile_payment'){
  ensure(uuid(x.checkout_id)&&safeInfiniteRef(x.transaction_nsu)&&safeInfiniteRef(x.slug),'Identificadores invalidos.',400);
  const entry=await sql('SELECT 1 FROM infinitepay_checkout_batches WHERE checkout_batch_id=$1',[x.checkout_id]);
  ensure(entry.rowCount,'Compra nao localizada.',404);
  const result=await reconcileInfinitepayBatch(x.checkout_id,{transaction_nsu:x.transaction_nsu,invoice_slug:x.slug});
  if(result.confirmed)await audit(u.id,'infinitepay.payment_reconciled','checkout',x.checkout_id,null,{result:result.result});
  return ok(result);
 }
 ensure(x.action==='record_payout'&&uuid(x.group_id),'Operacao invalida.',400);
 const reference=txt(x.transfer_reference,150),note=txt(x.notes,500);
 ensure(/^[A-Za-z0-9][A-Za-z0-9 _./:-]{7,149}$/.test(reference),'Informe identificador do Pix realmente realizado.',400);
 ensure(note.length>=8,'Informe data, destinatario e referencia do comprovante.',400);
 const result=await transaction(async c=>{
  const r=await c.query("SELECT g.*,o.payment_status AS order_payment,o.status AS order_status FROM supplier_order_groups g JOIN orders o ON o.id=g.order_id WHERE g.id=$1 FOR UPDATE OF g",[x.group_id]);
  ensure(r.rowCount,'Pedido de fornecedor nao encontrado.',404);const group=r.rows[0];
  ensure(group.payment_status==='approved'&&group.order_payment==='approved'&&['paid','processing','packing'].includes(group.order_status)&&group.fulfillment_status==='awaiting_payout',
   'Repasse indisponivel: pedido nao pago, ja registrado ou em disputa.',409);
  const payment=await c.query("SELECT 1 FROM payments WHERE order_id=$1 AND provider='infinitepay' AND status='approved'",[group.order_id]);
  ensure(payment.rowCount,'Pagamento InfinitePay nao validado.',409);
  const pix=await c.query('SELECT pix_type,pix_key,holder_name,updated_at FROM supplier_pix_accounts WHERE supplier_id=$1 FOR SHARE',[group.supplier_id]);
  ensure(pix.rowCount,'Fornecedor ainda não cadastrou uma chave Pix. Aguarde o cadastro antes de registrar o repasse.',409);
  const recipient=pix.rows[0];
  ensure(recipient.updated_at&&new Date(recipient.updated_at).toISOString()===String(x.pix_updated_at||''),
   'A chave Pix foi alterada desde que você abriu a página. Atualize os dados e confira o destinatário antes de registrar o pagamento.',409);
  const amount=Number(group.supplier_amount_cents);
  ensure(Number.isSafeInteger(amount)&&amount>0,'Valor do repasse invalido.',409);
  await c.query('INSERT INTO supplier_manual_payouts(group_id,supplier_id,amount_cents,transfer_reference,notes,recorded_by,pix_key_type,pix_key_suffix,pix_holder_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
   [group.id,group.supplier_id,amount,reference,note,u.id,recipient.pix_type,recipient.pix_key.slice(-4),recipient.holder_name]);
  const updated=await c.query("UPDATE supplier_order_groups SET fulfillment_status='paid',updated_at=now() WHERE id=$1 AND fulfillment_status='awaiting_payout' RETURNING id",[group.id]);
  ensure(updated.rowCount===1,'Não foi possível confirmar o repasse.',409);
  await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',
   [group.order_id,'supplier_paid','Repasse confirmado — pedido liberado para preparação',JSON.stringify({group_id:group.id,supplier_id:group.supplier_id})]);
  await auditTx(c,u.id,'supplier.pix_manual_recorded','supplier_group',group.id,null,{amount_cents:amount,transfer_reference:reference});
  return {id:group.id,amount_cents:amount,pix_key_mask:maskPixKey(recipient.pix_type,recipient.pix_key)};
 });
 return ok({recorded:true,...result});
 }catch(e){return fail(e)}}
