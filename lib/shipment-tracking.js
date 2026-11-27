import {randomUUID} from 'node:crypto';
import {sql,transaction} from '@/lib/db';
import {ensure} from '@/lib/http';
import {normalizeCode,validCode,trackShipment,trackingErrorMessage,terminalTracking} from '@/lib/pacotevicio.mjs';
const publicCache=r=>({group_id:r.group_id,tracking_code:r.tracking_code,carrier:r.carrier||'',fulfillment_status:r.fulfillment_status,snapshot:r.snapshot||null,fetched_at:r.fetched_at||null,next_attempt_at:r.next_attempt_at||null,error:r.error_code?trackingErrorMessage(r.error_code):null});
const query=`SELECT g.id AS group_id,upper(trim(COALESCE(g.tracking_code,''))) AS tracking_code,g.carrier,g.fulfillment_status,t.snapshot,t.fetched_at,t.next_attempt_at,t.error_code
 FROM supplier_order_groups g JOIN orders o ON o.id=g.order_id
 LEFT JOIN shipment_tracking_cache t ON t.group_id=g.id AND t.tracking_code=upper(trim(COALESCE(g.tracking_code,'')))
 WHERE o.customer_id=$1 AND o.id=$2 AND g.payment_status='approved'`;
export async function listTracking(userId,orderId){return (await sql(query+' ORDER BY g.created_at,g.id',[userId,orderId])).rows.map(publicCache);}
export async function refreshTracking(userId,orderId,groupId){
 const claim=await transaction(async c=>{
  // Authorize by order ownership. Never accept a tracking code from the browser.
  const group=(await c.query(`SELECT g.id AS group_id,g.carrier,g.fulfillment_status,upper(trim(COALESCE(g.tracking_code,''))) AS tracking_code FROM supplier_order_groups g JOIN orders o ON o.id=g.order_id WHERE g.id=$3 AND o.id=$2 AND o.customer_id=$1 AND g.payment_status='approved' FOR UPDATE OF g`,[userId,orderId,groupId])).rows[0];
  ensure(group,'Remessa não encontrada.',404);
  if(!['shipped','delivered'].includes(group.fulfillment_status)||!group.tracking_code)return {cached:publicCache(group)};
  if(!validCode(group.tracking_code))return {cached:publicCache({...group,error_code:'invalid_code'})};
  if(!process.env.PACOTEVICIO_API_KEY)return {cached:publicCache({...group,error_code:'not_configured'})};
  const current=(await c.query('SELECT * FROM shipment_tracking_cache WHERE group_id=$1',[groupId])).rows[0];
  if(current?.tracking_code===group.tracking_code&&(terminalTracking(current.snapshot)||Date.parse(current.next_attempt_at)>Date.now()))return {cached:publicCache({...group,...current})};
  // Serialize the shared conservative quota. A failed attempt also consumes the local budget.
  await c.query('SELECT pg_advisory_xact_lock(8033337)');
  const usage=(await c.query("SELECT count(*) FILTER (WHERE attempted_at>now()-interval '1 minute')::int AS minute,count(*)::int AS rolling FROM shipment_tracking_usage WHERE attempted_at>now()-interval '31 days'")).rows[0];
  if(usage.rolling>=900||usage.minute>=3)return {cached:publicCache({...group,...(current?.tracking_code===group.tracking_code?current:{}),error_code:usage.rolling>=900?'quota_exceeded':'rate_limit_exceeded'})};
  const token=randomUUID();
  await c.query("INSERT INTO shipment_tracking_usage DEFAULT VALUES");
  await c.query("INSERT INTO shipment_tracking_cache(group_id,tracking_code,next_attempt_at,attempt_token) VALUES($1,$2,now()+interval '1 hour',$3) ON CONFLICT(group_id) DO UPDATE SET tracking_code=EXCLUDED.tracking_code,snapshot=CASE WHEN shipment_tracking_cache.tracking_code=EXCLUDED.tracking_code THEN shipment_tracking_cache.snapshot ELSE NULL END,fetched_at=CASE WHEN shipment_tracking_cache.tracking_code=EXCLUDED.tracking_code THEN shipment_tracking_cache.fetched_at ELSE NULL END,next_attempt_at=EXCLUDED.next_attempt_at,attempt_token=EXCLUDED.attempt_token,error_code=NULL,updated_at=now()",[groupId,group.tracking_code,token]);
  return {group,token};
 });
 if(claim.cached)return claim.cached;
 let snapshot=null,error=null;
 try{snapshot=await trackShipment(normalizeCode(claim.group.tracking_code));}
 catch(e){error=String(e?.code||'temporary_failure').slice(0,80);}
 // Keep last successful data when the provider is unavailable; never change financial/order status.
 await sql("UPDATE shipment_tracking_cache SET snapshot=COALESCE($3::jsonb,snapshot),fetched_at=CASE WHEN $3::jsonb IS NOT NULL THEN now() ELSE fetched_at END,error_code=$4,attempt_token=NULL,updated_at=now() WHERE group_id=$1 AND attempt_token=$2 AND tracking_code=$5",[groupId,claim.token,snapshot?JSON.stringify(snapshot):null,error,claim.group.tracking_code]);
 const result=(await listTracking(userId,orderId)).find(g=>g.group_id===groupId);ensure(result,'Remessa não encontrada.',404);return result;
}

// Scheduled runner invokes the same ownership-checked cache service as the account page.
export async function refreshDueShipments(){
 const {rows}=await sql(`SELECT g.id AS group_id,g.order_id,o.customer_id FROM supplier_order_groups g JOIN orders o ON o.id=g.order_id LEFT JOIN shipment_tracking_cache t ON t.group_id=g.id AND t.tracking_code=upper(trim(COALESCE(g.tracking_code,''))) WHERE g.payment_status='approved' AND g.fulfillment_status IN ('shipped','delivered') AND nullif(trim(g.tracking_code),'') IS NOT NULL AND (t.next_attempt_at IS NULL OR t.next_attempt_at<=now()) AND COALESCE(t.snapshot->>'status','') NOT IN ('delivered','returned') AND t.snapshot->>'delivered_at' IS NULL ORDER BY t.next_attempt_at NULLS FIRST,g.created_at LIMIT 3`);
 const results=await Promise.allSettled(rows.map(g=>refreshTracking(g.customer_id,g.order_id,g.group_id)));
 return {checked:rows.length,completed:results.filter(x=>x.status==='fulfilled').length};
}
