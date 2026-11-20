import {sql,transaction} from '@/lib/db';import {quoteCart} from '@/lib/commerce';import {createMPOrder} from '@/lib/mercadopago';
import {requireUser} from '@/lib/auth';import {ok,fail,body,originGuard,ensure,HttpError,uuid,txt} from '@/lib/http';import {randomUUID} from 'node:crypto';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req,{params}){try{originGuard(req);const {action}=await params;const x=await body(req);if(!['quote','create'].includes(action))throw new HttpError(404,'Ação inválida.');
 const quoted=await quoteCart(x.items,x.coupon);
 if(action==='quote')return ok({quote:quoted});
 throw new HttpError(410,'Checkout antigo desativado. Utilize os pagamentos separados por fornecedor na VELLOR.');
 }catch(e){return fail(e)}}
