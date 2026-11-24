import {sql,transaction} from '@/lib/db';
import {requireUser,requireRole} from '@/lib/auth';
import {ok,fail,originGuard,body,ensure,uuid} from '@/lib/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
const roles=['admin','super_admin'];
const states=['open','under_review','approved','rejected','resolved'];
const stateLabels={open:'Aberta',under_review:'Em análise',approved:'Aprovada para tratamento',rejected:'Rejeitada',resolved:'Resolvida'};
async function context(req){
 const admin=new URL(req.url).searchParams.get('view')==='admin';
 const user=admin?await requireRole(req,roles):await requireUser(req);
 return {admin,user};
}
const selectBase=`SELECT r.id,r.order_id,r.type,r.status,r.reason,r.admin_note,r.created_at,r.resolved_at,o.order_number,u.full_name AS customer_name,
 (SELECT body FROM customer_request_messages m WHERE m.request_id=r.id ORDER BY id DESC LIMIT 1) AS last_message,
 (SELECT sender_kind FROM customer_request_messages m WHERE m.request_id=r.id ORDER BY id DESC LIMIT 1) AS last_sender,
 COALESCE((SELECT created_at FROM customer_request_messages m WHERE m.request_id=r.id ORDER BY id DESC LIMIT 1),r.created_at) AS last_message_at
 FROM customer_requests r JOIN orders o ON o.id=r.order_id JOIN users u ON u.id=r.user_id`;
export async function GET(req){try{
 const {admin,user}=await context(req);const q=new URL(req.url).searchParams,id=q.get('id'),orderId=q.get('order_id'),before=q.get('before'),after=q.get('after');
 if(orderId)ensure(uuid(orderId),'Pedido inválido.');
 ensure(!(before&&after),'Cursor inválido.');for(const cursor of [before,after])if(cursor)ensure(/^\d{1,19}$/.test(cursor)&&BigInt(cursor)<=9223372036854775807n,'Cursor inválido.');
 if(id){ensure(uuid(id),'Solicitação inválida.');
  const r=await sql(selectBase+' WHERE r.id=$1'+(admin?'':' AND r.user_id=$2 AND o.customer_id=$2'),admin?[id]:[id,user.id]);ensure(r.rowCount&&(!orderId||r.rows[0].order_id===orderId),'Solicitação não encontrada.',404);
  const messages=await sql('SELECT id,sender_kind,body,created_at FROM customer_request_messages WHERE request_id=$1'+(before?' AND id<$2::bigint':after?' AND id>$2::bigint':'')+(after?' ORDER BY id ASC LIMIT 101':' ORDER BY id DESC LIMIT 101'),before||after?[id,before||after]:[id]);
  return ok({thread:admin?r.rows[0]:{...r.rows[0],admin_note:undefined},messages:after?messages.rows.slice(0,100):messages.rows.slice(0,100).reverse(),has_more:messages.rows.length>100});
 }
 const args=admin?[]:[user.id];const conditions=admin?[]:['r.user_id=$1 AND o.customer_id=$1'];if(orderId){args.push(orderId);conditions.push('r.order_id=
 return ok({threads:admin?r.rows:r.rows.map(t=>({...t,admin_note:undefined}))});
}catch(e){return fail(e)}}
export async function POST(req){try{
 originGuard(req);const {admin,user}=await context(req);const x=await body(req,6000);
 ensure(uuid(x.id)&&['message','status'].includes(x.action),'Solicitação inválida.');
 const message=typeof x.message==='string'?x.message.trim():'';
 ensure(x.action==='message'?message.length>0&&message.length<=1200:admin&&states.includes(x.status),'Ação inválida.',400);
 await transaction(async c=>{
  const r=await c.query('SELECT r.id,r.order_id,r.status,o.order_number FROM customer_requests r JOIN orders o ON o.id=r.order_id WHERE r.id=$1'+(admin?'':' AND r.user_id=$2 AND o.customer_id=$2')+' FOR UPDATE OF r',admin?[x.id]:[x.id,user.id]);
  ensure(r.rowCount,'Solicitação não encontrada.',404);const t=r.rows[0];
  if(x.action==='status'){
   if(t.status===x.status)return;
   await c.query("UPDATE customer_requests SET status=$1,resolved_at=CASE WHEN $1 IN ('resolved','rejected') THEN now() ELSE NULL END WHERE id=$2",[x.status,t.id]);
   await c.query('INSERT INTO customer_request_messages(request_id,sender_kind,sender_user_id,body) VALUES($1,$2,$3,$4)',[t.id,'admin',user.id,'Situação da solicitação: '+stateLabels[x.status]+'.']);
   await c.query('INSERT INTO audit_logs(actor_id,action,resource_type,resource_id,after_data) VALUES($1,$2,$3,$4,$5)',[user.id,'request.update','request',t.id,JSON.stringify({status:x.status})]);
  }else{
   ensure(!['resolved','rejected'].includes(t.status),'Chamado encerrado. O histórico permanece disponível. A equipe pode reabri-lo se necessário.',409);
   const rate=await c.query("SELECT count(*)::int AS n FROM customer_request_messages WHERE request_id=$1 AND sender_user_id=$2 AND created_at>now()-interval '10 seconds'",[t.id,user.id]);ensure(rate.rows[0].n<4,'Aguarde antes de enviar outra mensagem.',429);
   await c.query('INSERT INTO customer_request_messages(request_id,sender_kind,sender_user_id,body) VALUES($1,$2,$3,$4)',[t.id,admin?'admin':'customer',user.id,message]);
   if(!admin){
    await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',[t.order_id,'request_message','Nova mensagem de solicitação',JSON.stringify({request_id:t.id,order_number:t.order_number})]);
   }
  }
 });return ok({success:true});
}catch(e){return fail(e)}}
+args.length);}
 const r=await sql(selectBase+(conditions.length?' WHERE '+conditions.join(' AND '):'')+" ORDER BY CASE WHEN r.status IN ('resolved','rejected') THEN 1 ELSE 0 END,last_message_at DESC,r.id DESC",args);
 return ok({threads:admin?r.rows:r.rows.map(t=>({...t,admin_note:undefined}))});
}catch(e){return fail(e)}}
export async function POST(req){try{
 originGuard(req);const {admin,user}=await context(req);const x=await body(req,6000);
 ensure(uuid(x.id)&&['message','status'].includes(x.action),'Solicitação inválida.');
 const message=typeof x.message==='string'?x.message.trim():'';
 ensure(x.action==='message'?message.length>0&&message.length<=1200:admin&&states.includes(x.status),'Ação inválida.',400);
 await transaction(async c=>{
  const r=await c.query('SELECT r.id,r.order_id,r.status,o.order_number FROM customer_requests r JOIN orders o ON o.id=r.order_id WHERE r.id=$1'+(admin?'':' AND r.user_id=$2 AND o.customer_id=$2')+' FOR UPDATE OF r',admin?[x.id]:[x.id,user.id]);
  ensure(r.rowCount,'Solicitação não encontrada.',404);const t=r.rows[0];
  if(x.action==='status'){
   await c.query("UPDATE customer_requests SET status=$1,resolved_at=CASE WHEN $1 IN ('resolved','rejected') THEN now() ELSE NULL END WHERE id=$2",[x.status,t.id]);
   await c.query('INSERT INTO customer_request_messages(request_id,sender_kind,sender_user_id,body) VALUES($1,$2,$3,$4)',[t.id,'admin',user.id,'Situação da solicitação: '+stateLabels[x.status]+'.']);
   await c.query('INSERT INTO audit_logs(actor_id,action,resource_type,resource_id,after_data) VALUES($1,$2,$3,$4,$5)',[user.id,'request.update','request',t.id,JSON.stringify({status:x.status})]);
  }else{
   const rate=await c.query("SELECT count(*)::int AS n FROM customer_request_messages WHERE request_id=$1 AND sender_user_id=$2 AND created_at>now()-interval '10 seconds'",[t.id,user.id]);ensure(rate.rows[0].n<4,'Aguarde antes de enviar outra mensagem.',429);
   await c.query('INSERT INTO customer_request_messages(request_id,sender_kind,sender_user_id,body) VALUES($1,$2,$3,$4)',[t.id,admin?'admin':'customer',user.id,message]);
   if(!admin){
    await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',[t.order_id,'request_message','Nova mensagem de solicitação',JSON.stringify({request_id:t.id,order_number:t.order_number})]);
   }
  }
 });return ok({success:true});
}catch(e){return fail(e)}}
