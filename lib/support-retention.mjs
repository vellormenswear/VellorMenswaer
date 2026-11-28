// Run in a transaction. Only dedicated chat tables and their own notifications are touched.
export async function purgeSupportHistory(c){
 const ai=await c.query("DELETE FROM support_ai_messages WHERE created_at<=now()-interval '24 hours'");
 const expired=await c.query("DELETE FROM support_threads WHERE status<>'bot' AND COALESCE(requested_at,created_at)<=now()-interval '30 days' RETURNING id");
 const ids=expired.rows.map(x=>x.id);
 if(ids.length)await c.query("DELETE FROM notifications WHERE kind='support_requested' AND payload->>'thread_id'=ANY($1::text[])",[ids]);
 const human=await c.query("DELETE FROM support_messages WHERE created_at<=now()-interval '30 days' OR (sender_kind='bot' AND created_at<=now()-interval '24 hours')");
 return {ai:ai.rowCount,human:human.rowCount,threads:ids.length};
}
