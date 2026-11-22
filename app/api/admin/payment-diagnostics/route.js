import {NextResponse} from 'next/server';
import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {supplierAccessToken,mpRequest} from '@/lib/marketplace';
import {ensure,fail,uuid} from '@/lib/http';
import {deriveMpPaymentDiagnosis,safePaymentDetail} from '@/lib/mp-payment-diagnosis.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const safeHost=url=>{try{return new URL(url).hostname.toLowerCase()}catch{return null}};

// Diagnóstico de pagamentos em sandbox, sem criar cobranças, pedidos nem confirmações.
export async function GET(req){
 try{
  await requireRole(req,['super_admin']);
  ensure(process.env.MP_MODE==='sandbox','Diagnóstico disponível apenas em sandbox.',403);
  const q=new URL(req.url).searchParams;
  const groupId=q.get('group_id');
  const preferenceId=q.get('preference_id');
  ensure(!groupId||uuid(groupId),'Identificador de checkout inválido.',400);
  ensure(!preferenceId||/^\d{3,20}-[a-f\d-]{30,50}$/i.test(preferenceId),'ID da preferência inválido.',400);
  const rows=await sql(`SELECT g.id,g.supplier_id,g.amount_cents,g.created_at,g.payment_status,
      g.preference_id,g.checkout_url,g.provider_payment_id,g.marketplace_fee_cents,g.order_id,mp.provider_user_id
    FROM supplier_order_groups g
    JOIN supplier_mp_connections mp ON mp.supplier_id=g.supplier_id
    WHERE ($1::uuid IS NULL OR g.id=$1::uuid)
      AND ($2::text IS NULL OR g.preference_id=$2::text)
      AND g.created_at>=now()-interval '14 days'
    ORDER BY g.created_at DESC LIMIT 10`,[groupId||null,preferenceId||null]);
  const groups=await Promise.all(rows.rows.map(async g=>{
   const base={group_id:g.id,preference_id:g.preference_id||null,
      created_at:g.created_at,amount_cents:g.amount_cents,
      local_status:g.payment_status,preference_created:!!g.preference_id,
      provider_payment_id:g.provider_payment_id||null,order_created:!!g.order_id,
      checkout_host:safeHost(g.checkout_url),seller_is_allowlisted_test_account:
       String(g.provider_user_id)===String(process.env.MP_SANDBOX_TEST_SELLER_USER_ID||'')};
   if(!g.preference_id)return {...base,
    error_diagnosis:{code:'PREFERENCE_NOT_CREATED',source:'vellor',exact_provider_reason:false,
     message:'Preferencia nao registrada. A falha pode ter ocorrido antes ou durante a criacao na API.',support_required:false},
    diagnosis:'Preferencia nao registrada. Verifique os logs de criacao da VELLOR.',attempts:[]};
   try{
    const token=await supplierAccessToken(g.supplier_id);
    const auth_type=token.startsWith('TEST-')?'TEST':token.startsWith('APP_USR-')?'APP_USR':'other';
    let preference=null;
    let preference_api=null;
    try{
     const mp=await mpRequest('/checkout/preferences/'+encodeURIComponent(g.preference_id),token,{onResponseMeta:meta=>{preference_api=meta}});
     preference={
      found:!!mp.id,collector_matches:String(mp.collector_id||'')===String(g.provider_user_id||''),
      has_init_point:/^https:\/\//.test(mp.init_point||''),
      has_sandbox_init_point:/^https:\/\//.test(mp.sandbox_init_point||''),
      init_point_host:safeHost(mp.init_point),
      sandbox_init_point_host:safeHost(mp.sandbox_init_point),
      payer_email_matches_authorized_customer:
       !!mp.payer?.email&&String(mp.payer.email).toLowerCase()===String(process.env.MP_SANDBOX_TEST_CUSTOMER_EMAIL||'').toLowerCase(),
      item_total_matches:Array.isArray(mp.items)&&Math.round(mp.items.reduce((sum,item)=>sum+Number(item.unit_price||0)*Number(item.quantity||0),0)*100)===Number(g.amount_cents),
      marketplace_setting:mp.marketplace||null,
      fee_matches:Math.round(Number(mp.marketplace_fee||0)*100)===Number(g.marketplace_fee_cents),
      expired:mp.preference_expired===true||!!mp.expiration_date_to&&
        new Date(mp.expiration_date_to).getTime()<Date.now()
     };
    }catch(e){preference={found:false,query_failed:true,api_error:e?.mpDiagnostic||null}}
    const params=new URLSearchParams({sort:'date_created',criteria:'desc',
      external_reference:g.id,limit:'10'});
    let payments_api=null;
    const found=await mpRequest('/v1/payments/search?'+params.toString(),token,{onResponseMeta:meta=>{payments_api=meta}});
    const attempts=(Array.isArray(found.results)?found.results:[])
      .filter(p=>String(p.external_reference||'')===String(g.id))
      .slice(0,5).map(p=>({
       payment_id:String(p.id||''),status:p.status||null,status_detail:p.status_detail||null,
       created_at:p.date_created||null,payment_method:p.payment_method_id||null,
       test_payment:p.live_mode===false,
       amount_matches:Number.isFinite(Number(p.transaction_amount))&&
         Math.round(Number(p.transaction_amount)*100)===Number(g.amount_cents),
       collector_matches:String(p.collector_id||'')===String(g.provider_user_id||'')
      }));
    // Merchant Orders podem existir mesmo quando Payments Search nao retorna nada.
    // Consultar apenas a preferencia deste grupo, sem expor informacoes pessoais.
    let merchant_orders;
    let merchant_orders_api=null;
    try{
     const params=new URLSearchParams({preference_id:String(g.preference_id),limit:'10',offset:'0'});
     const result=await mpRequest('/merchant_orders/search?'+params.toString(),token,{onResponseMeta:meta=>{merchant_orders_api=meta}});
     const elements=(Array.isArray(result.elements)?result.elements:[])
      .filter(o=>String(o.preference_id||'')===String(g.preference_id))
      .slice(0,10);
     merchant_orders={query_ok:true,total:Number(result.total||0),
      orders:elements.map(o=>({
       order_id:String(o.id||''),status:o.status||null,order_status:o.order_status||null,
       payments:Array.isArray(o.payments)?o.payments.slice(0,10).map(p=>({
        payment_id:String(p.id||''),status:p.status||null,status_detail:p.status_detail||null
       })):[]
      }))};
    }catch(e){
     merchant_orders={query_ok:false,orders:[],error:'Consulta de ordens comerciais nao disponivel.',api_error:e?.mpDiagnostic||null};
    }
    // Preferir o registro individual do pagamento: /v1/payments/{id} e a fonte
    // oficial do status_detail. Toda consulta e somente leitura e vinculada
    // ao grupo, ao recebedor, ao valor e a moeda BRL.
    const paymentIds=[...new Set([
     ...(g.provider_payment_id?[String(g.provider_payment_id)]:[]),
     ...attempts.map(p=>p.payment_id),
     ...(merchant_orders.orders||[]).flatMap(o=>(o.payments||[]).map(p=>p.payment_id))
    ])].filter(id=>/^\d{5,30}$/.test(id)).slice(0,3);
    const paymentDetails=await Promise.all(paymentIds.map(async id=>{
     let requestMeta=null;
     try{
      const payment=await mpRequest('/v1/payments/'+id,token,{onResponseMeta:m=>{requestMeta=m}});
      const reference_matches=String(payment.external_reference||'')===String(g.id);
      const collector_matches=String(payment.collector_id||'')===String(g.provider_user_id);
      const amount_matches=Number.isFinite(Number(payment.transaction_amount))&&
        Math.round(Number(payment.transaction_amount)*100)===Number(g.amount_cents);
      const currency_matches=payment.currency_id==='BRL';
      if(!reference_matches||!collector_matches||!amount_matches||!currency_matches){
       return {payment_id:id,verified:false,code:'PAYMENT_INTEGRITY_MISMATCH',
        checks:{reference_matches,collector_matches,amount_matches,currency_matches},
        api_request:requestMeta};
      }
      return {...safePaymentDetail(payment),verified:true,api_request:requestMeta};
     }catch(e){
      return {payment_id:id,verified:false,code:'PAYMENT_DETAIL_QUERY_FAILED',
       api_error:e?.mpDiagnostic||null};
     }
    }));
    const verifiedPayments=paymentDetails.filter(p=>p.verified);
    const error_diagnosis=deriveMpPaymentDiagnosis({
     verifiedPayments,paymentDetails,attempts,merchantOrders:merchant_orders,preference,
     localStatus:g.payment_status
    });
    const foundAttempt=attempts.length>0||merchant_orders.orders?.some(o=>o.payments?.length>0);
    return {...base,auth_type,preference,attempts,merchant_orders,
     provider_payment_details:paymentDetails,error_diagnosis,
     api_requests:{preference:preference_api,payments:payments_api,merchant_orders:merchant_orders_api},
     diagnosis:error_diagnosis.message};
   }catch(e){
    const error_diagnosis={
     code:'PAYMENT_API_QUERY_FAILED',source:'mercado_pago_api',exact_provider_reason:false,
     provider_error:e?.mpDiagnostic||null,
     message:'Consulta a API do Mercado Pago falhou. O motivo do checkout nao foi determinado.',
     support_required:true};
    return {...base,attempts:null,api_error:e?.mpDiagnostic||null,error_diagnosis,
     diagnosis:error_diagnosis.message};
   }
  }));
  return NextResponse.json({mode:'sandbox',checked_at:new Date().toISOString(),
    diagnostics_version:2,match_count:groups.length,groups,read_only:true},
    {headers:{'Cache-Control':'no-store, max-age=0','X-Robots-Tag':'noindex'}});
 }catch(e){return fail(e)}
}
