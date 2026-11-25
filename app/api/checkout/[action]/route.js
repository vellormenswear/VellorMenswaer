import {after} from 'next/server';
import {quoteCart} from '@/lib/commerce';
import {ok,fail,body,originGuard,HttpError} from '@/lib/http';
import {limitRequest} from '@/lib/rate-limit';
import {recordCheckoutEvent,safeTraceId} from '@/lib/checkout-trace';
export const runtime='nodejs';export const dynamic='force-dynamic';
function scheduleTrace(event){after(async()=>{try{await recordCheckoutEvent(event)}catch{console.warn('[checkout.trace] diagnostic unavailable')}})}
export async function POST(req,{params}){
 let tid=null;
 try{
  originGuard(req);const {action}=await params;
  if(action==='create')throw new HttpError(410,'Checkout antigo desativado. Finalize a compra pelo carrinho da VELLOR.');
  if(action!=='quote')throw new HttpError(404,'Ação inválida.');
  const x=await body(req);await limitRequest(req,'quote');tid=safeTraceId(x.trace_id);
  scheduleTrace({trace_id:tid,stage:'cart.quote.server_received',code:'QUOTE_RECEIVED',metadata:{item_count:Array.isArray(x.items)?x.items.length:0}});
  const quoted=await quoteCart(x.items,x.coupon);
  scheduleTrace({trace_id:tid,stage:'cart.quote.server_success',level:'success',code:'QUOTE_OK',metadata:{amount_cents:quoted.total_cents}});
  return ok({quote:quoted});
 }catch(e){if(tid)scheduleTrace({trace_id:tid,stage:'cart.quote.server_failed',level:'error',code:e?.code||'QUOTE_ERROR',http_status:e?.status||500,message:e?.message});return fail(e)}
}
