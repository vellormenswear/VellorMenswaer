import {NextResponse} from 'next/server';
import {originGuard,fail,ensure} from '@/lib/http';
import {recordCheckoutEvent} from '@/lib/checkout-trace';
export const runtime='nodejs';export const dynamic='force-dynamic';
const allowed=new Set([
 'catalog.loaded','catalog.failed','product.selected','product.variant','product.size','cart.added','cart.blocked',
 'cart.quantity','cart.removed','cart.opened','cart.quote.started','cart.quote.success','cart.quote.failed',
 'checkout.opened','checkout.auth','checkout.address','checkout.quote.started','checkout.quote.success',
 'checkout.quote.failed','checkout.create.started','checkout.create.success','checkout.create.failed',
 'checkout.groups.opened','checkout.groups.loaded','checkout.groups.failed',
 'payment.redirect','payment.status','payment.failed','client.error','client.promise_rejection']);
export async function POST(req){
 try{
  originGuard(req);
  const input=await req.text();
  ensure(input.length<=2000,'Evento muito grande.',413);
  let data;try{data=JSON.parse(input)}catch{data={}}
  ensure(data&&typeof data==='object'&&!Array.isArray(data),'Dados invalidos.',400);
  ensure(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.trace_id||''),'ID de rastreamento invalido.',400);
  ensure(allowed.has(data.stage),'Etapa de rastreamento nao permitida.',400);
  // Client events are untrusted hints, never proof of a payment.
  const saved=await recordCheckoutEvent({
   trace_id:data.trace_id,stage:data.stage,level:data.level,code:data.code,
   message:data.message,http_status:data.http_status,metadata:{...(data.metadata&&typeof data.metadata==='object'&&!Array.isArray(data.metadata)?data.metadata:{}),source:'browser_unverified'}
  },{client:true});
  return NextResponse.json({ok:true,persisted:saved.persisted,trace_id:saved.trace_id},
   {headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e)}
}
