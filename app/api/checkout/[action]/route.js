import {sql,transaction} from '@/lib/db';import {quoteCart} from '@/lib/commerce';
import {requireUser} from '@/lib/auth';import {ok,fail,body,originGuard,ensure,HttpError,uuid,txt} from '@/lib/http';import {randomUUID} from 'node:crypto';
import {recordCheckoutEvent,safeTraceId} from '@/lib/checkout-trace';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req,{params}){let tid=null;try{originGuard(req);const {action}=await params;const x=await body(req);tid=safeTraceId(x.trace_id);if(action==='quote')await recordCheckoutEvent({trace_id:tid,stage:'cart.quote.server_received',code:'QUOTE_RECEIVED',metadata:{item_count:Array.isArray(x.items)?x.items.length:0}});if(!['quote','create'].includes(action))throw new HttpError(404,'Ação inválida.');
 const quoted=await quoteCart(x.items,x.coupon);
 if(action==='quote'){await recordCheckoutEvent({trace_id:tid,stage:'cart.quote.server_success',level:'success',code:'QUOTE_OK',metadata:{amount_cents:quoted.total_cents}});return ok({quote:quoted});}
 throw new HttpError(410,'Checkout antigo desativado. Finalize a compra pelo carrinho da VELLOR.');
 }catch(e){await recordCheckoutEvent({trace_id:tid,stage:'cart.quote.server_failed',level:'error',code:e?.code||'QUOTE_ERROR',http_status:e?.status||500,message:e?.message});return fail(e)}}
