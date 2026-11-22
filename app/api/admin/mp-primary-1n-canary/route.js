import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {requireRole} from '@/lib/auth';
import {ensure,fail,originGuard} from '@/lib/http';
import {mpRequest} from '@/lib/marketplace';
import {oauthSellerId} from '@/lib/mp-oauth-identity.mjs';
import {primarySplitSandboxReady,primarySplitPlan,primarySplitPixPayload,
 hasActiveConsent,inspectPrimarySplitOrder,validReceiverId,validPrimaryOrderId} from '@/lib/mp-primary-split-1n.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(x,status=200)=>NextResponse.json(x,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
const mailRE=/^[^\s@]+@testuser\.com$/i;
const canUseSandbox=()=>process.env.MP_MODE==='sandbox'&&process.env.MP_LIVE_ENABLED!=='true';
const enabled=()=>canUseSandbox()&&process.env.MP_PRIMARY_1N_ENABLED==='true'&&process.env.MP_PRIMARY_1N_APPROVED==='true';

// Endpoint de teste ISOLADO: nao cria pedidos comerciais, nao movimenta estoque,
// nao executa pagamento real, nao altera tabelas e nao substitui o checkout atual.
async function primaryToken(){
 ensure(enabled(),'Split 1:N nao habilitado para este teste ou ambiente.',403);
 const token=String(process.env.MP_TEST_ACCESS_TOKEN||'');
 const ownerId=String(process.env.MP_PRIMARY_TEST_SELLER_USER_ID||'');
 ensure(token&&/^\d{3,20}$/.test(ownerId),'Token e vendedor principal de teste nao configurados.',503);
 ensure(String(process.env.MP_CLIENT_ID||'').match(/^\d+$/),'Aplicacao Mercado Pago nao configurada.',503);
 const identity=await oauthSellerId(token);
 ensure(identity===ownerId,'Token de teste nao pertence a conta principal VELLOR.',409);
 return {token,ownerId};
}

async function consentRequest(token,receiverId){
 const url='https://api.mercadopago.com/v1/split-consent?'+new URLSearchParams({status:'ACTIVE',receiver_id:receiverId});
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token,'x-test-token':'true'},
  cache:'no-store',signal:AbortSignal.timeout(15000)});
 ensure(r.ok,'Mercado Pago nao confirmou consentimento ACTIVE do fornecedor (HTTP '+r.status+').',502);
 return r.json().catch(()=>({}));
}

function planFor(ownerId){
 return primarySplitPlan({ownerId,totalCents:17000,
  partners:[{receiverId:process.env.MP_SECONDARY_TEST_RECEIVER_ID,amountCents:10000}]});
}

function ticketUrl(order){
 const p=order?.transactions?.payments?.[0];
 const raw=p?.payment_method?.ticket_url||p?.ticket_url;
 if(typeof raw!=='string')return null;
 try{const u=new URL(raw);return u.protocol==='https:'&&
  /(^|\.)mercadopago\.com(\.br)?$/.test(u.hostname)?raw:null}catch{return null}
}

export async function GET(req){
 try{
  await requireRole(req,['super_admin']);
  ensure(canUseSandbox(),'Disponivel somente em sandbox com pagamentos reais desligados.',403);
  const u=new URL(req.url),id=u.searchParams.get('order_id'),reference=u.searchParams.get('reference');
  if(!id)return reply({sandbox:true,enabled:enabled(),
    owner_set:!!process.env.MP_PRIMARY_TEST_SELLER_USER_ID,
    token_set:!!process.env.MP_TEST_ACCESS_TOKEN,
    consent_set:validReceiverId(process.env.MP_SECONDARY_TEST_RECEIVER_ID),
    partner_email_set:mailRE.test(process.env.MP_SECONDARY_TEST_SELLER_EMAIL||''),
    ready:primarySplitSandboxReady(process.env),
    note:'Somente teste isolado. Nao altera checkout comercial ou pedidos VELLOR.'});
  ensure(validPrimaryOrderId(id),'ID de order teste invalido.',400);
  const {token,ownerId}=await primaryToken();
  const plan=planFor(ownerId);
  const order=await mpRequest('/v1/orders/'+encodeURIComponent(id),token,{testToken:true});
  const audit=inspectPrimarySplitOrder(order,{plan,reference,clientId:process.env.MP_CLIENT_ID});
  ensure(audit.safe,'Order nao corresponde ao experimento da VELLOR.',403);
  return reply({order_id:id,reference,status:audit.status,status_detail:audit.status_detail,
   approved:audit.approved,checks:audit.checks,ticket_url:ticketUrl(order),diagnostic_only:true});
 }catch(e){return fail(e)}
}

export async function POST(req){
 try{
  originGuard(req);
  await requireRole(req,['super_admin']);
  ensure(canUseSandbox(),'Operacao permitida apenas no sandbox.',403);
  const {token,ownerId}=await primaryToken();
  const input=await req.json().catch(()=>({}));
  ensure(input&&['create_consent','pix'].includes(input.action),'Acao invalida.',400);
  if(input.action==='create_consent'){
   const sellerEmail=String(process.env.MP_SECONDARY_TEST_SELLER_EMAIL||'').trim();
   ensure(mailRE.test(sellerEmail),'Defina o email @testuser.com do fornecedor secundario.',503);
   const response=await fetch('https://api.mercadopago.com/v1/split-consent',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',
     'X-Idempotency-Key':randomUUID(),'x-test-token':'true','x-test-status':'ACTIVE'},
    body:JSON.stringify({invites:[{seller_email:sellerEmail}]}),
    cache:'no-store',signal:AbortSignal.timeout(15000)
   });
   const data=await response.json().catch(()=>({}));
   ensure(response.ok,'Mercado Pago recusou consentimento de teste (HTTP '+response.status+').',502);
   const row=Array.isArray(data?.succeeded)?data.succeeded.find(x=>
    x?.seller_email?.toLowerCase()===sellerEmail.toLowerCase()&&
    x?.status==='ACTIVE'&&validReceiverId(x?.receiver_id)):null;
   ensure(row,'Mercado Pago nao retornou consentimento ACTIVE para o fornecedor.',502);
   return reply({status:'ACTIVE',receiver_id:row.receiver_id,
    note:'Consentimento somente de teste. Guarde o receiver_id para configurar o split; nao e um User ID.'},201);
  }
  ensure(primarySplitSandboxReady(process.env),'Configuracao do split 1:N de teste incompleta.',503);
  const plan=planFor(ownerId);
  const consent=await consentRequest(token,process.env.MP_SECONDARY_TEST_RECEIVER_ID);
  ensure(hasActiveConsent(consent,process.env.MP_SECONDARY_TEST_RECEIVER_ID),
   'O fornecedor nao possui consentimento ACTIVE na conta principal.',409);
  const reference='vellor-primary-1n-test-'+randomUUID();
  const payload=primarySplitPixPayload({plan,reference,payerEmail:process.env.MP_SANDBOX_TEST_CUSTOMER_EMAIL});
  const order=await mpRequest('/v1/orders',token,{method:'POST',data:payload,idempotency:randomUUID(),testToken:true});
  const audit=inspectPrimarySplitOrder(order,{plan,reference,clientId:process.env.MP_CLIENT_ID});
  ensure(audit.safe,'Resposta do Mercado Pago diverge de vendedor principal, fornecedor ou valores.',502);
  return reply({order_id:order.id,reference,mode:'primary-owner-1n',amount_cents:17000,
   owner_cents:7000,supplier_cents:10000,status:audit.status,status_detail:audit.status_detail,
   approved:audit.approved,checks:audit.checks,ticket_url:ticketUrl(order),
   note:'Teste PIX sandbox. Sem pedido VELLOR, estoque ou conciliacao comercial.'},201);
 }catch(e){return fail(e)}
}
