import {HttpError} from '@/lib/http';
import {INFINITEPAY_BASE,infinitepayConfigured,safeInfiniteCheckoutLink} from '@/lib/infinitepay.mjs';
export async function infinitepayApi(path,payload){
 if(!infinitepayConfigured(process.env))throw new HttpError(503,'InfinitePay sem chave ou InfiniteTag valida.');
 if(!['/links','/payment_check'].includes(path))throw new HttpError(400,'Endpoint nao autorizado.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
 try{
  const r=await fetch(INFINITEPAY_BASE+path,{method:'POST',cache:'no-store',
   headers:{'Content-Type':'application/json','X-Api-Key':process.env.INFINITEPAY_API_KEY},
   body:JSON.stringify(payload),signal:controller.signal});
  const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw new HttpError(502,'Resposta invalida da InfinitePay.')}
  if(!r.ok)throw new HttpError(502,'InfinitePay recusou a operacao (HTTP '+r.status+').');
  return data;
 }catch(e){if(e instanceof HttpError)throw e;throw new HttpError(502,'Nao foi possivel consultar a InfinitePay.')}
 finally{clearTimeout(timer)}
}
export function infinitepayLink(data){
 return safeInfiniteCheckoutLink(data?.url||data?.checkout_url||data?.link_url||data?.link||'');
}
