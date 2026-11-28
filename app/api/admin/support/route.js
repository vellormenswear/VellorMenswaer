import {sql,db,transaction} from '@/lib/db';
import {requireRole} from '@/lib/auth';
import {ok,fail,body,originGuard,ensure,uuid,HttpError} from '@/lib/http';
import {applyMarketplaceMigrations} from '@/lib/marketplace-auto-schema.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ADM=['admin','super_admin'];
async function ready(){const r=await sql("SELECT to_regclass('public.support_threads') AS thread, to_regclass('public.support_messages') AS message, to_regclass('public.support_ai_messages') AS ai");return Boolean(r.rows[0]?.thread&&r.rows[0]?.message&&r.rows[0]?.ai);}
export async function GET(req){
 try{
  await requireRole(req,ADM);
  if(!await ready())return ok({ready:false,threads:[]});
  const id=new URL(req.url).searchParams.get('id');
  if(id){
   ensure(uuid(id),'Identificador inválido.');
   const t=await sql("SELECT t.id,t.status,t.title,t.rating,t.rating_comment,t.rated_at,t.created_at,t.requested_at,t.last_message_at,COALESCE(u.full_name,'Visitante') AS customer_name,u.email AS customer_email FROM support_threads t LEFT JOIN users u ON u.id=t.customer_id WHERE t.id=$1 AND t.status<>'bot' AND COALESCE(t.requested_at,t.created_at)>now()-interval '30 days'",[id]);
   ensure(t.rowCount,'Atendimento não encontrado.',404);
   const m=await sql("SELECT m.id,m.sender_kind,m.body,m.created_at,u.full_name AS sender_name FROM support_messages m LEFT JOIN users u ON u.id=m.sender_user_id WHERE m.thread_id=$1 AND m.created_at>now()-interval '30 days' AND (m.sender_kind<>'bot' OR m.created_at>now()-interval '24 hours') ORDER BY m.id DESC LIMIT 150",[id]);
   return ok({ready:true,thread:t.rows[0],messages:m.rows.reverse()});
  }
  const r=await sql("SELECT t.id,t.status,t.title,t.rating,t.rating_comment,t.rated_at,t.created_at,t.requested_at,t.last_message_at,COALESCE(u.full_name,'Visitante') AS customer_name,u.email AS customer_email,(SELECT m.body FROM support_messages m WHERE m.thread_id=t.id AND m.created_at>now()-interval '30 days' AND (m.sender_kind<>'bot' OR m.created_at>now()-interval '24 hours') ORDER BY m.id DESC LIMIT 1) AS last_message FROM support_threads t LEFT JOIN users u ON u.id=t.customer_id WHERE t.status<>'bot' AND COALESCE(t.requested_at,t.created_at)>now()-interval '30 days' ORDER BY CASE WHEN t.status='waiting' THEN 0 WHEN t.status='active' THEN 1 ELSE 2 END,t.last_message_at DESC LIMIT 150");
  return ok({ready:true,threads:r.rows,pending:r.rows.filter(x=>x.status==='waiting').length});
 }catch(e){return fail(e);}
}
export async function POST(req){
 try{
  originGuard(req);
  const u=await requireRole(req,ADM);
  const x=await body(req,6000);
  if(x?.action==='initialize'){
   const migrated=await applyMarketplaceMigrations(()=>db().connect());
   return ok({ready:await ready(),applied:migrated.applied});
  }
  ensure(await ready(),'Atendimento ainda não foi inicializado.',503);
  ensure(uuid(x?.thread_id),'Identificador inválido.');
  ensure(['reply','start','close','reopen'].includes(x?.action),'Ação inválida.');
  let message='';
  if(x.action==='reply'){message=String(x.message||'').trim();ensure(message.length>0&&message.length<=1200,'Resposta deve conter de 1 a 1.200 caracteres.');}
  await transaction(async client=>{
   const t=await client.query("SELECT status FROM support_threads WHERE id=$1 AND status<>'bot' AND COALESCE(requested_at,created_at)>now()-interval '30 days' FOR UPDATE",[x.thread_id]);
   if(!t.rowCount)throw new HttpError(404,'Atendimento não encontrado.');
   if(x.action==='start'){ensure(t.rows[0].status==='waiting','Atendimento não está pendente.',409);await client.query("UPDATE support_threads SET status='active',assigned_to=$2,updated_at=now() WHERE id=$1",[x.thread_id,u.id]);}
   else if(x.action==='reply'){
    ensure(t.rows[0].status!=='closed','Reabra a conversa antes de responder.',409);
    await client.query("INSERT INTO support_messages(thread_id,sender_kind,sender_user_id,body) VALUES($1,'admin',$2,$3)",[x.thread_id,u.id,message]);
    await client.query("UPDATE support_threads SET status='active',assigned_to=$2,last_message_at=now(),updated_at=now() WHERE id=$1",[x.thread_id,u.id]);
   }else{
    if(x.action==='close'){ensure(t.rows[0].status!=='closed','Atendimento já finalizado.',409);await client.query("UPDATE support_threads SET status='closed',closed_at=now(),updated_at=now() WHERE id=$1",[x.thread_id]);}
    else{ensure(t.rows[0].status==='closed','Atendimento ainda aberto.',409);await client.query("UPDATE support_threads SET status='waiting',closed_at=NULL,updated_at=now() WHERE id=$1",[x.thread_id]);}
   }
  });
  return ok({success:true});
 }catch(e){return fail(e);}
}
