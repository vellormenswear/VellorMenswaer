import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {ensure,fail,originGuard,body} from '@/lib/http';
import {supplierAccessToken,mpRequest} from '@/lib/marketplace';
import {oauthSellerId} from '@/lib/mp-oauth-identity.mjs';
import {validateCheckoutProUrl} from '@/lib/mp-checkout-url.mjs';
import {canaryOrderPayload,inspectCanaryOrder,orderIdValid} from '@/lib/mp-orders-canary.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const respond=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
async function scope(req){
 await requireRole(req,['super_admin']);
 ensure(process.env.MP_MODE==='sandbox'&&process.env.MP_LIVE_ENABLED!=='true','Experimento permitido somente no sandbox.',403);
 const sellerId=String(process.env.MP_SANDBOX_TEST_SELLER_USER_ID||'').trim();
 ensure(/^\d+$/.test(sellerId),'Vendedor de teste não configurado.',503);
 const linked=await sql('SELECT supplier_id FROM supplier_mp_connections WHERE provider_user_id=$1 LIMIT 2',[sellerId]);
 ensure(linked.rowCount===1,'Vendedor de teste precisa ter uma conexão OAuth única.',409);
 const token=await supplierAccessToken(linked.rows[0].supplier_id);
 ensure(token.startsWith('APP_USR-'),'A credencial OAuth do vendedor deve ser APP_USR.',409);
 ensure((await oauthSellerId(token))===sellerId,'OAuth associado ao vendedor incorreto.',409);
 return {sellerId,token};
}
export async function POST(req){
 try{
  originGuard(req);
  const {sellerId,token}=await scope(req);
  const input=await body(req,2000);
  ensure(['simple','split'].includes(input.mode),'Escolha teste simples ou split.',400);
  const idempotencyKey=randomUUID();
  const payload=canaryOrderPayload(input.mode,`vellor-orders-canary-${input.mode}-${idempotencyKey}`);
  let meta=null;
  const order=await mpRequest('/v1/orders',token,{method:'POST',data:payload,idempotency:idempotencyKey,onResponseMeta:m=>{meta=m}});
  const audit=inspectCanaryOrder(order,{sellerId,clientId:process.env.MP_CLIENT_ID});
  ensure(audit.safe,'Orders API retornou uma order divergente dos dados do teste; link bloqueado.',502);
  const checkoutUrl=validateCheckoutProUrl(order.checkout_url);
  ensure(checkoutUrl,'Orders API não retornou checkout_url HTTPS autorizado.',502);
  // Não registrar tokens, dados de cartão ou URLs com parâmetros de sessão nos logs.
  return respond({order_id:order.id,mode:input.mode,amount_cents:2000,marketplace_fee_cents:input.mode==='split'?1000:0,
   checkout_url:checkoutUrl,status:audit.status,status_detail:audit.status_detail,
   checks:audit.checks,http_status:meta?.http_status||null,request_id:meta?.request_id||null,
   note:'Orders API, conta vendedora de teste, checkout convidado. Não cria pedido nem efetua conciliação na VELLOR.',read_only:false},201);
 }catch(e){return fail(e)}
}
export async function GET(req){
 try{
  const {sellerId,token}=await scope(req);
  const id=new URL(req.url).searchParams.get('order_id');
  ensure(orderIdValid(id),'Order de sandbox inválida.',400);
  const order=await mpRequest('/v1/orders/'+encodeURIComponent(id),token);
  const audit=inspectCanaryOrder(order,{sellerId,clientId:process.env.MP_CLIENT_ID});
  ensure(audit.safe,'A order não pertence ao teste isolado autorizado.',403);
  return respond({order_id:id,mode:audit.mode,status:audit.status,status_detail:audit.status_detail,
   total_paid_cents:audit.total_paid_cents,transactions:audit.transactions,checks:audit.checks,diagnostic_only:true,read_only:true});
 }catch(e){return fail(e)}
}
