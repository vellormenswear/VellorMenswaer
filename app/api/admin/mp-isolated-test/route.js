import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {ensure,fail,originGuard} from '@/lib/http';
import {supplierAccessToken,mpRequest} from '@/lib/marketplace';
import {checkoutProLink,checkoutProHost} from '@/lib/mp-checkout-url.mjs';
import {safePaymentDetail} from '@/lib/mp-payment-diagnosis.mjs';
import {checkoutCreationIntegrity} from '@/lib/mp-checkout-creation-integrity.mjs';
import {isolatedPreferencePayload,isIsolatedTestPreference,getTestMode,safeCreationDiagnostic,safeHost} from '@/lib/mp-isolated-test.mjs';
import {recordCheckoutEvent,safeTraceId,traceForPreference} from '@/lib/checkout-trace';
export const runtime='nodejs';export const dynamic='force-dynamic';

async function scope(req){
 await requireRole(req,['super_admin','admin']);
 ensure(process.env.MP_MODE==='sandbox','Teste isolado disponivel apenas em sandbox.',403);
 const sellerId=String(process.env.MP_SANDBOX_TEST_SELLER_USER_ID||'').trim();
 ensure(/^\d+$/.test(sellerId)&&process.env.MP_SANDBOX_TEST_CUSTOMER_EMAIL,
  'Contas compradora e vendedora de teste nao estao configuradas.',503);
 const r=await sql('SELECT supplier_id,provider_user_id FROM supplier_mp_connections WHERE provider_user_id=$1 LIMIT 1',[sellerId]);
 ensure(r.rowCount,'Conta vendedora de teste precisa estar conectada.',409);
 const token=await supplierAccessToken(r.rows[0].supplier_id);
 ensure(token.startsWith('APP_USR-'),'Token OAuth do vendedor de teste invalido.',409);
 const identity=await mpRequest('/users/me',token);
 ensure(String(identity?.id||'')===sellerId,'Credencial OAuth pertence a outro vendedor.',409);
 return {sellerId,token};
}
const result=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});

export async function POST(req){
 let tid=null;try{
  originGuard(req);
  const {sellerId,token}=await scope(req);
  const body=await req.json().catch(()=>({}));tid=safeTraceId(body?.trace_id);
  const mode=body?.mode;
  ensure(mode==='simple'||mode==='split','Modo invalido. Escolha simple ou split.',400);
  const payload=isolatedPreferencePayload(mode);
  await recordCheckoutEvent({trace_id:tid,stage:'payment.isolated_test.started',code:'ISOLATED_TEST_STARTED',metadata:{checkout_mode:mode,amount_cents:2000}});
  let meta=null;
  const pref=await mpRequest('/checkout/preferences',token,{
   method:'POST',data:payload,idempotency:'vellor-diag-'+randomUUID(),
   onResponseMeta:m=>{meta=m}
  });
  ensure(pref?.id,'O Mercado Pago nao retornou uma preferencia.',502);
  const integrity=checkoutCreationIntegrity({preference:pref,request:payload,sellerId,clientId:process.env.MP_CLIENT_ID});
  ensure(integrity.ok,'Preferencia nao corresponde a conta, aplicativo, valor ou comissao esperados ('+integrity.code+').',502);
  // Checkout Pro OAuth APP_USR usa init_point mesmo com contas de teste.
  const checkoutUrl=checkoutProLink(pref);
  ensure(checkoutUrl,'Mercado Pago nao retornou um init_point HTTPS valido.',502);
  await recordCheckoutEvent({trace_id:tid,stage:'payment.isolated_test.preference_created',level:'success',code:'MP_PREFERENCE_CREATED',preference_id:String(pref.id),http_status:meta?.http_status||201,metadata:{checkout_mode:mode,host:checkoutProHost(checkoutUrl),request_id:meta?.request_id}});
  const creation_diagnostic=safeCreationDiagnostic({request:payload,preference:pref,meta,sellerId,mode});
  return result({
   mode,sandbox:true,trace_id:tid,amount_cents:2000,
   marketplace_fee_cents:mode==='split'?100:0,
   preference_id:String(pref.id),
   creation_diagnostic,preference_integrity:integrity.checks,
   checkout_field_used:'init_point',
   checkout_initial_host:checkoutProHost(checkoutUrl),
   checkout_url:checkoutUrl,
   checkout_url_available:true,
   note:'Checkout Pro utiliza init_point com vendedor OAuth de teste. Nao utilize dados de pagamento reais.',
   http_status:meta?.http_status||null,request_id:meta?.request_id||null,
   order_created:false,read_only:false
  },201);
 }catch(e){await recordCheckoutEvent({trace_id:tid,stage:'payment.isolated_test.failed',level:'error',code:e?.mpDiagnostic?.code||'ISOLATED_TEST_FAILED',http_status:e?.status||500,message:e?.message});return fail(e)}
}
export async function GET(req){
 try{
  const {sellerId,token}=await scope(req);
  const id=new URL(req.url).searchParams.get('preference_id');
  ensure(/^\d{3,20}-[a-f0-9-]{30,50}$/i.test(id||''),'ID de preferencia invalido.',400);
  const pref=await mpRequest('/checkout/preferences/'+encodeURIComponent(id),token);
  ensure(isIsolatedTestPreference(pref,sellerId),'Preferencia fora do teste isolado.',403);
  let orderResponse=null,ordersError=null;
  try{
   const params=new URLSearchParams({preference_id:id,limit:'10',offset:'0'});
   orderResponse=await mpRequest('/merchant_orders/search?'+params,token);
  }catch(e){ordersError=e.mpDiagnostic||{code:'ORDER_SEARCH_FAILED'}}
  const orders=(Array.isArray(orderResponse?.elements)?orderResponse.elements:[])
   .filter(o=>String(o.preference_id||'')===id).slice(0,5);
  const paymentIds=[...new Set(orders.flatMap(o=>(Array.isArray(o.payments)?o.payments:[])
   .map(p=>String(p.id||''))))].filter(v=>/^\d{5,30}$/.test(v)).slice(0,5);
  const payments=await Promise.all(paymentIds.map(async paymentId=>{
   try{
    const p=await mpRequest('/v1/payments/'+paymentId,token);
    const matches=String(p.collector_id||'')===sellerId&&p.currency_id==='BRL'&&
     Math.round(Number(p.transaction_amount)*100)===2000&&p.live_mode===false;
    return matches?{...safePaymentDetail(p),verified:true}:
     {payment_id:paymentId,verified:false,code:'INTEGRITY_MISMATCH'};
   }catch(e){return {payment_id:paymentId,verified:false,code:'DETAIL_UNAVAILABLE',api_error:e.mpDiagnostic||null}}
  }));
  const isApproved=payments.some(p=>p.verified&&p.status==='approved');
  const rejected=payments.find(p=>p.verified&&p.status==='rejected');
  const noLinkedPayments=paymentIds.length===0;
  // Como a preferencia diagnostica nao define external_reference,
  // nao ha chave segura para consultar e associar pagamentos independentes.
  // Sem merchant order, informar escopo limitado em vez de afirmar ausencia global.
  const paymentLookupScope='merchant_orders_linked_payments_only';
  const tid=await traceForPreference(id);
  await recordCheckoutEvent({trace_id:tid,stage:'payment.isolated_test.checked',level:ordersError?'error':isApproved?'success':'info',code:ordersError?'ORDER_QUERY_INCOMPLETE':isApproved?'PAYMENT_APPROVED':orders.length?'ORDER_FOUND':'ORDER_NOT_FOUND',preference_id:id,metadata:{checkout_mode:getTestMode(pref),payment_count:paymentIds.length}});
  return result({
   preference_id:id,mode:getTestMode(pref),amount_cents:2000,marketplace_fee_cents:getTestMode(pref)==='split'?100:0,
   checkout_url_hosts:{init_point:safeHost(pref.init_point),
    sandbox_init_point:safeHost(pref.sandbox_init_point)},
   checkout_field_used:'init_point',
   merchant_orders:orders.map(o=>({order_id:String(o.id||''),status:o.status||null,
    order_status:o.order_status||null,payment_count:Array.isArray(o.payments)?o.payments.length:0})),
   payments,query_error:ordersError,
   payment_lookup_scope:paymentLookupScope,independent_payment_search_performed:false,
   outcome:ordersError?'ORDER_QUERY_INCOMPLETE':isApproved?'APPROVED':
    rejected?'REJECTED':noLinkedPayments?(orders.length?'ORDER_WITHOUT_PAYMENT':'NO_MERCHANT_ORDER_FOUND'):
    'PAYMENT_NOT_APPROVED',
   outcome_explanation:ordersError?
    'Nao foi possivel consultar todas as ordens comerciais; resultado inconclusivo.':
    isApproved?'Pagamento aprovado e vinculado a ordem comercial.':
    rejected?'Pagamento recusado e vinculado a ordem comercial.':
    noLinkedPayments?(orders.length?
     'Ordem comercial encontrada, mas sem pagamentos vinculados ate a consulta.':
     'Nenhuma ordem comercial foi encontrada para esta preferencia. Sem busca independente por pagamentos, nao e possivel afirmar que nenhum pagamento existe.'):
    'Existe pagamento vinculado, mas nao foi confirmada aprovacao.',
   exact_reason_available:!!rejected?.status_detail,
   reason_code:rejected?.status_detail||null,
   diagnostic_only:true,read_only:true
  });
 }catch(e){return fail(e)}
}
