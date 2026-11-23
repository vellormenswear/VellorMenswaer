import {sql} from '@/lib/db';
import {ok,fail,ensure} from '@/lib/http';
import {secureCompare} from '@/lib/security';
import {reconcileAsaasBatch,expireAsaasBatch} from '@/lib/asaas-reconcile';
import {asaasSandboxConfigured} from '@/lib/asaas.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const eventRE=/^evt_[a-z0-9_&-]{6,140}$/i;
export async function POST(req){try{
 ensure(asaasSandboxConfigured(process.env),'Webhook somente em sandbox.',503);
 const expected=process.env.ASAAS_WEBHOOK_TOKEN||'';
 const token=req.headers.get('asaas-access-token')||'';
 ensure(expected.length>=32&&secureCompare(token,expected),'Webhook Asaas não autenticado.',401);
 const raw=await req.text();ensure(raw.length<=50000,'Evento excessivo.',413);
 let payload;try{payload=JSON.parse(raw)}catch{throw Error('Webhook JSON inválido.')}
 ensure(eventRE.test(String(payload?.id||'')),'Evento Asaas inválido.',400);
 const kind=String(payload.event||'');
 const checkoutId=String(payload.checkout?.id||'');
 ensure(/^[0-9a-f-]{36}$/i.test(checkoutId),'Checkout sem identificador.',400);
 const mapped=await sql('SELECT checkout_batch_id FROM asaas_checkout_batches WHERE provider_checkout_id=$1',[checkoutId]);
 if(!mapped.rowCount)return ok({ignored:'checkout_not_managed'});
 const batch=mapped.rows[0].checkout_batch_id;
 const exists=await sql('SELECT status FROM asaas_webhook_events WHERE id=$1',[payload.id]);
 if(exists.rows[0]?.status==='processed')return ok({duplicate:true});
 await sql("INSERT INTO asaas_webhook_events(id,event_type,checkout_id,status) VALUES($1,$2,$3,'received') ON CONFLICT(id) DO NOTHING",[payload.id,kind,checkoutId]);
 let action='ignored';
 if(kind==='CHECKOUT_PAID'){
  // Mesmo com Webhook autenticado, consultar a API oficial e confrontar o pagamento.
  const result=await reconcileAsaasBatch(batch);
  ensure(result.confirmed,'Evento recebido mas pagamento ainda nao conferido na API.',409);
  action='confirmed';
 }else if(['CHECKOUT_EXPIRED','CHECKOUT_CANCELED'].includes(kind)){
  await expireAsaasBatch(batch);action='expired';
 }else if(kind==='CHECKOUT_CREATED')action='created';
 await sql("UPDATE asaas_webhook_events SET status='processed',processed_at=now() WHERE id=$1",[payload.id]);
 return ok({accepted:true,action});
 }catch(e){return fail(e)}}
