// VELLOR InfinitePay: checkout real somente quando a operação é habilitada explicitamente.
import {canPurchase} from './purchase-role.mjs';
const BASE='https://api.checkout.infinitepay.io';
export const INFINITEPAY_BASE=BASE;
export const validInfiniteTag=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9._-]{1,80}$/i.test(v);
export const infinitepayConfigured=env=>typeof env?.INFINITEPAY_API_KEY==='string'&&/^inchk_[A-Za-z0-9_-]{12,}$/.test(env.INFINITEPAY_API_KEY)
 &&validInfiniteTag(env.INFINITEPAY_HANDLE);
export const infinitepayReady=(env,user)=>{
 if(!infinitepayConfigured(env)||env.INFINITEPAY_CHECKOUT_ENABLED!=='true'||env.STORE_OPEN_FOR_ORDERS!=='true'||!env.DATABASE_URL
  ||!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(env.SITE_URL||'')||!canPurchase(user))return false;
 // Abertura comercial: clientes, administradores e superadministradores autenticados podem pagar.
 // A cobrança real continua dependendo dos dois controles de ativação,
 // das credenciais oficiais e da validação dos valores no servidor.
 return true;
};
export const safeInfiniteRef=v=>typeof v==='string'&&/^[a-z0-9_-]{3,160}$/i.test(v);
export const safeInfiniteCheckoutLink=url=>{
 try{
  const u=new URL(url);const h=u.hostname.toLowerCase();
  return u.protocol==='https:'&&(h==='infinitepay.io'||h.endsWith('.infinitepay.io')||h==='infinitepay.com.br'||h.endsWith('.infinitepay.com.br'))
   &&!u.username&&!u.password&&u.port===''&&u.href.length<=2500?u.href:null;
 }catch{return null}
};
export function buildInfinitepayCheckout(groups,{batchId,site,expiresAt}={}){
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(batchId||'')||
 !Array.isArray(groups)||groups.length<1||groups.length>20||
 !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(site||''))throw Error('Dados de checkout invalidos');
 const deadline=new Date(expiresAt);
 if(Number.isNaN(deadline.getTime())||deadline.getTime()<=Date.now()+60000||
    deadline.getTime()>Date.now()+3*60*60*1000)throw Error('Validade de pagamento invalida');
 let total=0,cost=0;
 const items=groups.map((g,i)=>{
  const amount=Number(g.amount_cents),part=Number(g.supplier_amount_cents);
  if(!Number.isSafeInteger(amount)||amount<1||!Number.isSafeInteger(part)||part<0||part>=amount)
   throw Error('Valor de fornecedor invalido');
  total+=amount;cost+=part;
  return {description:'VELLOR - pedido '+(i+1),price:amount,quantity:1};
 });
 if(!Number.isSafeInteger(total)||total<100||!Number.isSafeInteger(cost)||cost>=total)
  throw Error('Valor de checkout invalido');
 return {payload:{items,order_nsu:batchId,
  redirect_url:site+'/pagamento/grupos?checkout_id='+encodeURIComponent(batchId),
  webhook:{url:site+'/api/webhooks/infinitepay',events:['paid','refunded','canceled']},
  options:{single_payment:true,valid_until:deadline.toISOString(),payment_methods_enabled:['credit_card','pix']}},
  total_cents:total,supplier_cents:cost};
}
export function verifiedInfinitepayPayment(response,expectedAmount){
 return response?.success===true&&response.paid===true&&
  Number.isSafeInteger(expectedAmount)&&Number(response.amount)===expectedAmount&&
  Number.isSafeInteger(Number(response.paid_amount))&&Number(response.paid_amount)>=expectedAmount&&
  ['pix','credit_card'].includes(response.capture_method);
}
