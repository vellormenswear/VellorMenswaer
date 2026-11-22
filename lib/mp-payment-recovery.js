import {sql} from '@/lib/db';
import {supplierAccessToken,mpRequest} from '@/lib/marketplace';
import {reconcilePayment} from '@/lib/split-reconcile';
import {paidStatus} from '@/lib/supplier-checkout.mjs';
import {ensure,HttpError} from '@/lib/http';
import {recordCheckoutEvent,ensureTraceTable,traceForGroup} from '@/lib/checkout-trace';
import {paymentCandidates,paymentIntegrity,preferenceIntegrity,safeProviderCode} from '@/lib/mp-payment-recovery.mjs';

// Recuperacao sob demanda: busca registros REAIS no MP e concilia apenas apos
// confirmar a identidade do seller, valor, referencia, moeda e ambiente.
export async function recheckProviderPayment(group){
 const traceId=await traceForGroup(group.id);
 await ensureTraceTable();
 const recent=await sql(`SELECT 1 FROM checkout_trace_events
   WHERE group_id=$1 AND stage='payment.recheck.requested'
   AND created_at>now()-interval '25 seconds' LIMIT 1`,[group.id]);
 if(recent.rowCount)throw new HttpError(429,'Consulta recente. Aguarde alguns segundos e tente novamente.');
 await recordCheckoutEvent({trace_id:traceId,stage:'payment.recheck.requested',code:'RECHECK_STARTED',
   group_id:group.id,preference_id:group.preference_id,metadata:{source:'mercado_pago'}});
 try{
  ensure(group.preference_id,'Preferencia nao criada para este grupo.',409);
  const token=await supplierAccessToken(group.supplier_id);
  if(process.env.MP_MODE==='sandbox'){
   ensure(String(group.provider_user_id)===String(process.env.MP_SANDBOX_TEST_SELLER_USER_ID||'')&&
    token.startsWith('APP_USR-'),'Vendedor de teste nao autorizado.',403);
  }
  const pref=await mpRequest('/checkout/preferences/'+encodeURIComponent(group.preference_id),token);
  const prefMismatch=preferenceIntegrity(pref,group);
  if(prefMismatch){
   await recordCheckoutEvent({trace_id:traceId,stage:'payment.recheck.integrity_error',
    level:'error',code:prefMismatch,group_id:group.id,preference_id:group.preference_id});
   throw new HttpError(409,'Os dados da preferencia nao correspondem ao grupo. Nenhum pagamento foi confirmado. Codigo: '+prefMismatch);
  }
  // Consultas independentes: merchant order e Payments Search podem divergir.
  const queries=await Promise.allSettled([
   mpRequest('/v1/payments/search?'+new URLSearchParams({external_reference:group.id,sort:'date_created',criteria:'desc',limit:'10'}),token),
   mpRequest('/merchant_orders/search?'+new URLSearchParams({preference_id:group.preference_id,limit:'10',offset:'0'}),token)
  ]);
  const paymentSearch=queries[0].status==='fulfilled'?queries[0].value:null;
  const orderSearch=queries[1].status==='fulfilled'?queries[1].value:null;
  if(!paymentSearch&&!orderSearch)throw new HttpError(502,'Mercado Pago nao respondeu as consultas de pagamentos e ordens.');
  const candidates=paymentCandidates({payments:paymentSearch||{},merchantOrders:orderSearch||{},group});
  let unverified=0,providerPayment=null;
  for(const id of candidates){
   try{
    const p=await mpRequest('/v1/payments/'+id,token);
    const error=paymentIntegrity(p,group,process.env.MP_MODE==='production');
    if(error){
     unverified++;
     await recordCheckoutEvent({trace_id:traceId,stage:'payment.recheck.integrity_error',level:'error',
      code:error,group_id:group.id,preference_id:group.preference_id,metadata:{payment_id:id}});
     continue;
    }
    if(!providerPayment||p.status==='approved'||(!['approved','pending','in_process'].includes(providerPayment.status)&&p.status==='pending'))providerPayment=p;
    if(p.status==='approved')break;
   }catch(e){
    if(e?.mpDiagnostic)await recordCheckoutEvent({trace_id:traceId,stage:'payment.recheck.payment_query_failed',level:'warning',
     code:e.mpDiagnostic.code||'PAYMENT_QUERY_FAILED',group_id:group.id,metadata:{payment_id:id,request_id:e.mpDiagnostic.request_id}});
   }
  }
  if(!providerPayment){
   const order=(Array.isArray(orderSearch?.elements)?orderSearch.elements:[])
    .find(o=>String(o.preference_id||'')===group.preference_id);
   const result=candidates.length?'PAYMENT_UNVERIFIED':queries.some(q=>q.status==='rejected')?'PAYMENT_LOOKUP_INCOMPLETE':order?'MERCHANT_ORDER_WITHOUT_PAYMENT':'NO_PROVIDER_PAYMENT_FOUND';
   await recordCheckoutEvent({trace_id:traceId,stage:'payment.recheck.completed',
    code:result,group_id:group.id,preference_id:group.preference_id,
    metadata:{payment_count:candidates.length,provider_status:order?.order_status||null}});
   return {result,provider_status:order?.order_status||null,
    reason:unverified?'Pagamento localizado, mas dados de integridade divergentes.':
     queries.some(q=>q.status==='rejected')?'Uma consulta ao provedor falhou; nao foi possivel concluir a verificacao.':
     'Sem status_detail de recusa disponivel; o provedor nao retornou pagamento verificavel.',
    checked:true,reconciled:false};
  }
  const status=providerPayment.status;
  const status_detail=safeProviderCode(providerPayment.status_detail);
  const reconciled=await reconcilePayment(providerPayment,String(group.provider_user_id));
  const confirmed=paidStatus(providerPayment)&&reconciled?.status==='approved'&&!reconciled.requires_refund;
  const refundRequired=reconciled?.requires_refund===true;
  const result=confirmed?'APPROVED':refundRequired?'REFUND_REQUIRED':
    status==='rejected'?'REJECTED':status==='approved'?'PAYMENT_IN_VERIFICATION':'PAYMENT_FOUND';
  await recordCheckoutEvent({trace_id:traceId,stage:'payment.recheck.completed',
   level:confirmed?'success':refundRequired||status==='rejected'?'warning':'info',
   code:'MP_'+result,
   group_id:group.id,preference_id:group.preference_id,
   metadata:{payment_id:String(providerPayment.id),provider_status:status,status_detail}});
  return {result,provider_status:safeProviderCode(status),status_detail,
   checked:true,reconciled:!!reconciled};
 }catch(e){
  await recordCheckoutEvent({trace_id:traceId,stage:'payment.recheck.failed',
   level:'error',code:e?.mpDiagnostic?.code||'RECHECK_FAILED',http_status:e?.status||500,
   message:e?.message,group_id:group.id,preference_id:group.preference_id});
  throw e;
 }
}
