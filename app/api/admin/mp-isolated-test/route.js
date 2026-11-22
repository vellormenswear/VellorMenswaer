import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {ensure,fail,originGuard} from '@/lib/http';
import {supplierAccessToken,mpRequest} from '@/lib/marketplace';
import {validateSandboxCheckoutUrl} from '@/lib/mp-sandbox-link.mjs';
import {safePaymentDetail} from '@/lib/mp-payment-diagnosis.mjs';
import {isolatedPreferencePayload,isIsolatedTestPreference,getTestMode} from '@/lib/mp-isolated-test.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';

async function scope(req){
 await requireRole(req,['super_admin']);
 ensure(process.env.MP_MODE==='sandbox','Teste isolado disponivel apenas em sandbox.',403);
 const sellerId=String(process.env.MP_SANDBOX_TEST_SELLER_USER_ID||'').trim();
 ensure(/^\d+$/.test(sellerId)&&process.env.MP_SANDBOX_TEST_CUSTOMER_EMAIL,
  'Contas compradora e vendedora de teste nao estao configuradas.',503);
 const r=await sql('SELECT supplier_id,provider_user_id FROM supplier_mp_connections WHERE provider_user_id=$1 LIMIT 1',[sellerId]);
 ensure(r.rowCount,'Conta vendedora de teste precisa estar conectada.',409);
 const token=await supplierAccessToken(r.rows[0].supplier_id);
 ensure(token.startsWith('APP_USR-'),'Token OAuth do vendedor de teste invalido.',409);
 return {sellerId,token};
}
const result=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});

export async function POST(req){
 try{
  originGuard(req);
  const {sellerId,token}=await scope(req);
  const body=await req.json().catch(()=>({}));
  const mode=body?.mode;
  ensure(mode==='simple'||mode==='split','Modo invalido. Escolha simple ou split.',400);
  const payload=isolatedPreferencePayload(mode);
  let meta=null;
  const pref=await mpRequest('/checkout/preferences',token,{
   method:'POST',data:payload,idempotency:'vellor-diag-'+randomUUID(),
   onResponseMeta:m=>{meta=m}
  });
  ensure(pref?.id,'O Mercado Pago nao retornou uma preferencia.',502);
  ensure(String(pref.collector_id||sellerId)===sellerId,'Recebedor inesperado no teste.',502);
  // Nao reconstruir links: validar o sandbox_init_point exato do provedor.
  const sandboxUrl=validateSandboxCheckoutUrl(pref.sandbox_init_point);
  return result({
   mode,sandbox:true,amount_cents:2000,
   marketplace_fee_cents:mode==='split'?100:0,
   preference_id:String(pref.id),
   sandbox_checkout_url:sandboxUrl,
   sandbox_url_available:!!sandboxUrl,
   note:sandboxUrl?'Link alternativo de sandbox gerado.':'A preferencia foi criada, mas nao retornou sandbox_init_point valido.',
   http_status:meta?.http_status||null,request_id:meta?.request_id||null,
   order_created:false,read_only:false
  },201);
 }catch(e){return fail(e)}
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
  const noPayments=paymentIds.length===0;
  return result({
   preference_id:id,mode:getTestMode(pref),amount_cents:2000,marketplace_fee_cents:getTestMode(pref)==='split'?100:0,
   checkout_url_hosts:{init_point:(()=>{try{return new URL(pref.init_point).hostname}catch{return null}})(),
    sandbox_init_point:(()=>{try{return new URL(pref.sandbox_init_point).hostname}catch{return null}})()},
   merchant_orders:orders.map(o=>({order_id:String(o.id||''),status:o.status||null,
    order_status:o.order_status||null,payment_count:Array.isArray(o.payments)?o.payments.length:0})),
   payments,query_error:ordersError,
   outcome:ordersError?'ORDER_QUERY_INCOMPLETE':isApproved?'APPROVED':
    rejected?'REJECTED':noPayments?(orders.length?'ORDER_WITHOUT_PAYMENT':'NO_ORDER_OR_PAYMENT'):
    'PAYMENT_NOT_APPROVED',
   exact_reason_available:!!rejected?.status_detail,
   reason_code:rejected?.status_detail||null,
   diagnostic_only:true,read_only:true
  });
 }catch(e){return fail(e)}
}
