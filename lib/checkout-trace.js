import {randomUUID} from 'node:crypto';
import {db,sql} from '@/lib/db';
const validUuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
export const safeTraceId=value=>validUuid(value)?value.toLowerCase():randomUUID();
const clip=(v,n)=>String(v??'').slice(0,n);
export function safeTraceMessage(value){
 let text=clip(value,1600);
 text=text.replace(/(?:https?:\/\/|www\.)[^\s"'<>]+/gi,'[URL_REMOVIDA]');
 text=text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,'[EMAIL_REMOVIDO]');
 text=text.replace(/\b(?:Bearer\s+)?(?:APP_USR-|TEST-|eyJ[A-Za-z0-9_-]{12,}|rtk=|access_token=|code=)[^\s,;"']{8,}/gi,'[CREDENCIAL_REMOVIDA]');
 text=text.replace(/\b\d{11,16}\b/g,'[NUMERO_REMOVIDO]');
 return text.slice(0,320);
}
const safeCode=v=>clip(v,80).replace(/[^a-zA-Z0-9_.:-]/g,'_')||'UNSPECIFIED';
const safeStage=v=>/^[a-z][a-z0-9_.]{2,63}$/.test(String(v||''))?String(v):'trace.invalid_stage';
const safeLevel=v=>['info','warning','error','success'].includes(v)?v:'info';
const metadataKeys=new Set(['sku','quantity','item_count','group_count','amount_cents','fee_cents',
 'status','status_detail','phase','source','host','request_id','payment_id','provider_status',
 'checkout_mode','collector_matches','fee_matches','session_role','error_kind','duration_ms',
 'provider_live_mode','rejection_detail','field','payment_count','method','auth_type']);
function safeMetadata(source){
 const out={};
 if(!source||typeof source!=='object'||Array.isArray(source))return out;
 for(const [key,v] of Object.entries(source)){
  if(!metadataKeys.has(key)||v===null||v===undefined)continue;
  if(typeof v==='boolean')out[key]=v;
  else if(typeof v==='number'&&Number.isFinite(v))out[key]=Math.max(-1e9,Math.min(1e9,Math.round(v*100)/100));
  else if(typeof v==='string'){
   if(key==='sku')out[key]=clip(v,120).replace(/[^a-zA-Z0-9_-]/g,'_');
   else out[key]=safeTraceMessage(v).slice(0,110);
  }
 }
 return out;
}
export function safeTraceEvent(e={}){
 return {
  trace_id:safeTraceId(e.trace_id),
  stage:safeStage(e.stage),level:safeLevel(e.level),code:safeCode(e.code||e.stage),
  message:e.message?safeTraceMessage(e.message):null,
  http_status:Number.isInteger(e.http_status)&&e.http_status>=100&&e.http_status<=599?e.http_status:null,
  checkout_batch_id:validUuid(e.checkout_batch_id)?e.checkout_batch_id:null,
  group_id:validUuid(e.group_id)?e.group_id:null,
  preference_id:/^\d{3,20}-[a-f0-9-]{30,50}$/i.test(e.preference_id||'')?String(e.preference_id):null,
  metadata:safeMetadata(e.metadata)
 };
}
let readyPromise=null;
export async function ensureTraceTable(){
 if(!readyPromise)readyPromise=(async()=>{
  const c=await db().connect();let begun=false;
  try{
   await c.query('BEGIN');begun=true;
   await c.query("SET LOCAL statement_timeout = '12000ms'");
   await c.query("SET LOCAL lock_timeout = '6s'");
   await c.query('SELECT pg_advisory_xact_lock($1)',[84511316]);
   const exists=await c.query("SELECT to_regclass('public.checkout_trace_events') AS ref");
   if(!exists.rows[0]?.ref){
    await c.query(`CREATE TABLE IF NOT EXISTS checkout_trace_events(
      id bigserial PRIMARY KEY,trace_id uuid NOT NULL,
      stage varchar(64) NOT NULL,level varchar(12) NOT NULL,
      code varchar(80) NOT NULL,message varchar(320),
      http_status integer,checkout_batch_id uuid,group_id uuid,
      preference_id varchar(100),metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await c.query('CREATE INDEX IF NOT EXISTS checkout_trace_id_time_idx ON checkout_trace_events(trace_id,created_at DESC)');
    await c.query('CREATE INDEX IF NOT EXISTS checkout_trace_created_idx ON checkout_trace_events(created_at DESC)');
    await c.query('CREATE INDEX IF NOT EXISTS checkout_trace_group_idx ON checkout_trace_events(group_id) WHERE group_id IS NOT NULL');
    await c.query('CREATE INDEX IF NOT EXISTS checkout_trace_pref_idx ON checkout_trace_events(preference_id) WHERE preference_id IS NOT NULL');
   }
   await c.query('COMMIT');begun=false;
  }catch(e){if(begun)try{await c.query('ROLLBACK')}catch{};throw e}
  finally{c.release()}
 })().catch(e=>{readyPromise=null;throw e});
 return readyPromise;
}
export async function recordCheckoutEvent(raw,opts={}){
 const e=safeTraceEvent(raw);
 console.info('[checkout.trace]',JSON.stringify(e));
 if(opts.consoleOnly)return {trace_id:e.trace_id,persisted:false};
 try{
  await ensureTraceTable();
  const isClient=opts.client===true;
  if(isClient){
   const counter=await sql("SELECT COUNT(*)::int AS count FROM checkout_trace_events WHERE trace_id=$1 AND created_at>now()-interval '1 day'",[e.trace_id]);
   if(Number(counter.rows[0]?.count)>=180)return {trace_id:e.trace_id,persisted:false,limited:true};
  }
  await sql(`INSERT INTO checkout_trace_events(trace_id,stage,level,code,message,http_status,checkout_batch_id,group_id,preference_id,metadata)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,[e.trace_id,e.stage,e.level,e.code,e.message,e.http_status,e.checkout_batch_id,e.group_id,e.preference_id,JSON.stringify(e.metadata)]);
  return {trace_id:e.trace_id,persisted:true};
 }catch(err){
  console.warn('[checkout.trace.storage_failure]',JSON.stringify({trace_id:e.trace_id,stage:e.stage,reason:safeCode(err?.code||'UNAVAILABLE')}));
  return {trace_id:e.trace_id,persisted:false};
 }
}
export async function traceForGroup(groupId){
 if(!validUuid(groupId))return null;
 try{
  await ensureTraceTable();
  const r=await sql('SELECT trace_id FROM checkout_trace_events WHERE group_id=$1 ORDER BY id ASC LIMIT 1',[groupId]);
  return r.rows[0]?.trace_id||null;
 }catch{return null}
}

// Consultas de auditoria correlacionadas; nunca revelam tokens OAuth.
export async function traceForPreference(preferenceId){
 if(!/^\d{3,20}-[a-f0-9-]{30,50}$/i.test(preferenceId||''))return null;
 try{
  await ensureTraceTable();
  const r=await sql('SELECT trace_id FROM checkout_trace_events WHERE preference_id=$1 ORDER BY id ASC LIMIT 1',[preferenceId]);
  return r.rows[0]?.trace_id||null;
 }catch{return null}
}
