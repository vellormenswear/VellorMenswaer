import {NextResponse} from 'next/server';
import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {ensureTraceTable} from '@/lib/checkout-trace';
import {fail,ensure} from '@/lib/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req){
 try{
  await requireRole(req,['admin','super_admin']);
  await ensureTraceTable();
  const p=new URL(req.url).searchParams;
  const trace=p.get('trace_id'),group=p.get('group_id'),pref=p.get('preference_id'),errors=p.get('errors')==='true';
  if(trace)ensure(/^[0-9a-f-]{36}$/i.test(trace),'Trace ID invalido.',400);
  if(group)ensure(/^[0-9a-f-]{36}$/i.test(group),'ID de grupo invalido.',400);
  if(pref)ensure(/^\d{3,20}-[a-f0-9-]{30,50}$/i.test(pref),'Preferencia invalida.',400);
  const params=[trace||null,group||null,pref||null,errors];
  const rows=await sql(`SELECT id,trace_id,stage,level,code,message,http_status,
   checkout_batch_id,group_id,preference_id,metadata,created_at
   FROM checkout_trace_events
   WHERE created_at>now()-interval '30 days'
   AND ($1::uuid IS NULL OR trace_id=$1::uuid)
   AND ($2::uuid IS NULL OR group_id=$2::uuid OR trace_id IN(
    SELECT trace_id FROM checkout_trace_events WHERE group_id=$2::uuid))
   AND ($3::text IS NULL OR preference_id=$3::text OR trace_id IN(
    SELECT trace_id FROM checkout_trace_events WHERE preference_id=$3::text))
   AND ($4::boolean=false OR level IN ('error','warning'))
   ORDER BY id DESC LIMIT 300`,params);
  const events=rows.rows;
  return NextResponse.json({
   events,limit:300,retention_days:30,storage:'neon',access:'admin_or_super_admin',
   note:'Mensagens e metadados sao tratados. Erros internos do Mercado Pago indisponiveis na API nao podem ser recuperados automaticamente.'
  },{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
 }catch(e){return fail(e)}
}
