// Diagnosticador exclusivo do sandbox. O status_detail vem da API oficial do
// Mercado Pago, mas pode ser generico; nunca inferimos a causa interna de seu checkout.
const safeCode=value=>{
 if(typeof value!=='string')return null;
 const s=value.trim();
 return /^[a-z][a-z0-9_]{0,63}$/i.test(s)&&
  !/^(?:APP_USR|TEST|Bearer|eyJ)/i.test(s)?s:null;
};
const safeStatus=value=>{
 const s=safeCode(value);return s&&['approved','pending','in_process','rejected',
 'cancelled','canceled','refunded','charged_back','authorized','in_mediation'].includes(s)?s:null;
};
export function safePaymentDetail(payment){
 const id=String(payment?.id||'');
 return {payment_id:/^\d{5,30}$/.test(id)?id:null,
  status:safeStatus(payment?.status),status_detail:safeCode(payment?.status_detail),
  method:safeCode(payment?.payment_method_id),test_payment:payment?.live_mode===false};
}
export function deriveMpPaymentDiagnosis({
 verifiedPayments=[],paymentDetails=[],attempts=[],merchantOrders={},preference=null,localStatus=null
}={}){
 const rejected=verifiedPayments.find(p=>['rejected','cancelled','canceled'].includes(p.status)&&p.status_detail);
 if(rejected)return {
  code:rejected.status_detail,source:'mercado_pago_payment_status_detail',exact_provider_reason:true,
  provider_payment_status:rejected.status,payment_id:rejected.payment_id,
  message:'O Mercado Pago registrou uma recusa e informou status_detail: '+rejected.status_detail+
   '. O codigo e oficial, mas pode nao detalhar o motivo interno do emissor.',
  support_required:false
 };
 const p=verifiedPayments.find(x=>x.status==='approved')||verifiedPayments[0];
 if(p){
  const approved=p.status==='approved';
  return {code:approved&&localStatus!=='approved'?'RECONCILIATION_PENDING':
   (p.status_detail||p.status||'PAYMENT_STATUS_UNAVAILABLE'),
   source:'mercado_pago_payment',exact_provider_reason:false,payment_id:p.payment_id,
   provider_payment_status:p.status,provider_status_detail:p.status_detail,
   message:approved?(localStatus==='approved'?'Pagamento confirmado pela VELLOR e Mercado Pago.':
     'O pagamento consta aprovado no Mercado Pago, mas a VELLOR ainda nao o confirmou. Verificar conciliacao.'):
    'Pagamento localizado no Mercado Pago. Status: '+(p.status||'desconhecido')+
    (p.status_detail?', detalhe: '+p.status_detail:'')+'.',
   support_required:approved&&localStatus!=='approved'};
 }
 if(paymentDetails.length){
  const mismatch=paymentDetails.some(x=>x.code==='PAYMENT_INTEGRITY_MISMATCH');
  return {code:mismatch?'PAYMENT_INTEGRITY_MISMATCH':'PAYMENT_DETAIL_UNAVAILABLE',
   source:'mercado_pago_payment_lookup',exact_provider_reason:false,
   message:mismatch?'O pagamento localizado nao corresponde integralmente ao grupo, vendedor, valor ou moeda. Nenhuma confirmacao foi assumida.':
    'Ha referencia a um pagamento, mas nao foi possivel confirmar seus detalhes pela API.',
   support_required:true};
 }
 if(attempts.length){
  return {code:'PAYMENT_SEARCH_UNVERIFIED',source:'mercado_pago_payments_search',
   exact_provider_reason:false,message:'Ha registros na busca de pagamentos, mas nao foram confirmados por ID.',
   support_required:true};
 }
 if(merchantOrders?.query_ok===false||preference?.query_failed){
  const errors=[merchantOrders?.api_error,preference?.api_error].filter(Boolean);
  return {code:'INCOMPLETE_PROVIDER_DIAGNOSTIC',source:'mercado_pago_api',
   exact_provider_reason:false,api_errors:errors,
   message:'A consulta do Mercado Pago ficou incompleta; nao e possivel confirmar o motivo.',
   support_required:true};
 }
 if(preference?.found===false){
  return {code:'PREFERENCE_LOOKUP_FAILED',source:'mercado_pago_api',
   exact_provider_reason:false,message:'Preferencia de pagamento nao encontrada na consulta.',
   support_required:true};
 }
 const p=preference||{};
 const mismatch=Object.entries({
  collector_matches:'COLLECTOR_MISMATCH',item_total_matches:'ITEM_TOTAL_MISMATCH',
  fee_matches:'MARKETPLACE_FEE_MISMATCH',
  payer_email_matches_authorized_customer:'PAYER_EMAIL_MISMATCH'
 }).find(([key])=>p[key]===false);
 if(mismatch){
  return {code:mismatch[1],source:'vellor_preference_validation',
   exact_provider_reason:false,message:'Foi detectada divergencia na configuracao da preferencia. Isto nao prova ser a causa do erro de checkout.',
   support_required:true};
 }
 if(merchantOrders?.orders?.length){
  return {code:'PAYMENT_NOT_FOUND',source:'mercado_pago_merchant_orders',
   exact_provider_reason:false,
   message:'O Mercado Pago criou a ordem comercial, mas nao retornou transacao de pagamento. O motivo interno do checkout nao e fornecido por esta API.',
   support_required:true};
 }
 return {code:'NO_PAYMENT_OR_MERCHANT_ORDER_FOUND',source:'mercado_pago_queries',
  exact_provider_reason:false,
  message:'Nenhum pagamento nem ordem comercial localizado. Sem codigo de recusa oficial disponivel.',
  support_required:true};
}
