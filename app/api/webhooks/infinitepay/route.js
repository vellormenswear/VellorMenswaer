import {createHash} from 'node:crypto';
import {sql} from '@/lib/db';
import {ok,fail,ensure} from '@/lib/http';
import {infinitepayConfigured,safeInfiniteRef} from '@/lib/infinitepay.mjs';
import {reconcileInfinitepayBatch} from '@/lib/infinitepay-reconcile';
export const runtime='nodejs';export const dynamic='force-dynamic';
// InfinitePay nao assina webhook. NENHUM aviso isolado confirma pagamento.
// A unica fonte de aprovacao e POST /payment_check autenticado no servidor.
export async function POST(req){try{
 ensure(infinitepayConfigured(process.env),'Integracao desativada.',503);
 const raw=await req.text();ensure(raw.length>0&&raw.length<=50000,'Corpo invalido.',413);
 let event;try{event=JSON.parse(raw)}catch{ensure(false,'JSON invalido.',400)}
 const orderNsu=String(event?.order_nsu||'');
 const transaction=String(event?.transaction_nsu||'');
 const slug=String(event?.invoice_slug||event?.slug||'');
 ensure(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(orderNsu)
  &&safeInfiniteRef(transaction)&&safeInfiniteRef(slug),'Evento sem referencias validas.',400);
 const eventType=String(event?.event||event?.type||'paid').slice(0,40);
 const found=await sql('SELECT checkout_batch_id FROM infinitepay_checkout_batches WHERE order_nsu=$1',[orderNsu]);
 if(!found.rowCount)return ok({ignored:'not_managed'});
 const key=createHash('sha256').update(orderNsu+'|'+transaction+'|'+slug+'|'+eventType).digest('hex');
 await sql("INSERT INTO infinitepay_webhook_events(event_key,order_nsu,event_type) VALUES($1,$2,$3) ON CONFLICT(event_key) DO NOTHING",[key,orderNsu,eventType]);
 if(['refunded','canceled','payment_failed'].includes(eventType)){
  // Sem assinatura, uma mensagem externa nao pode cancelar ou estornar um pedido real.
  await sql("UPDATE infinitepay_webhook_events SET status='requires_review',processed_at=now() WHERE event_key=$1",[key]);
  return ok({accepted:true,requires_review:true});
 }
 if(!['paid','settled','created'].includes(eventType))return ok({ignored:'unsupported_event'});
 // Mesmo que eventType=created, apenas confirma se a API oficial aprovar.
 const result=await reconcileInfinitepayBatch(found.rows[0].checkout_batch_id,{transaction_nsu:transaction,invoice_slug:slug});
 if(!result.confirmed)return ok({accepted:true,confirmed:false});
 await sql("UPDATE infinitepay_webhook_events SET status='processed',processed_at=now() WHERE event_key=$1",[key]);
 return ok({accepted:true,confirmed:true,result:result.result});
 }catch(e){return fail(e)}
}
