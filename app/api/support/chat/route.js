import {sql,transaction} from '@/lib/db';
import {getUser} from '@/lib/auth';
import {randomToken,sha256} from '@/lib/security';
import {ok,fail,body,originGuard,ensure,HttpError} from '@/lib/http';
import {customerOrderLabel,customerPaymentLabel} from '@/lib/customer-order-status.mjs';
import {supportReply,orderQuestion,orderNumber,humanQuestion} from '@/lib/support-faq.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const COOKIE='vellor_support_session';
const AGE=60*60*24*30;
function tokenOf(req){const c=req.headers.get('cookie')||'';return c.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
async function snapshot(hash,userId=null){
 if(!hash)return {status:'bot',messages:[]};
 const result=await sql('SELECT id,status FROM support_threads WHERE visitor_token_hash=$1 AND (customer_id IS NULL OR customer_id=$2)',[hash,userId]);
 if(!result.rowCount)return {status:'bot',messages:[]};
 const t=result.rows[0];
 const messages=await sql('SELECT m.id,m.sender_kind,m.body,m.created_at,u.full_name AS sender_name FROM support_messages m LEFT JOIN users u ON u.id=m.sender_user_id WHERE m.thread_id=$1 ORDER BY m.id DESC LIMIT 100',[t.id]);
 return {status:t.status,messages:messages.rows.reverse()};
}
export async function GET(req){
 try{const u=await getUser(req);return ok(await snapshot(tokenOf(req)?sha256(tokenOf(req)):'',u?.id||null));}
 catch(e){return fail(e);}
}
export async function POST(req){
 try{
  originGuard(req);
  const input=await body(req,5000);
  const action=input?.action;
  ensure(action==='message'||action==='request_human','Ação inválida.');
  const message=String(input?.message||'').trim();
  if(action==='message')ensure(message.length>0&&message.length<=1200,'A mensagem deve ter até 1.200 caracteres.');
  let token=tokenOf(req);
  if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))token=randomToken();
  const user=await getUser(req);
  if(token){const prior=await sql('SELECT customer_id FROM support_threads WHERE visitor_token_hash=$1',[sha256(token)]);if(prior.rowCount&&prior.rows[0].customer_id&&prior.rows[0].customer_id!==user?.id)token=randomToken();}
  let hash=sha256(token);
  const claim=()=>sql('INSERT INTO support_threads(visitor_token_hash,customer_id) VALUES($1,$2) ON CONFLICT(visitor_token_hash) DO UPDATE SET customer_id=COALESCE(support_threads.customer_id,excluded.customer_id) WHERE support_threads.customer_id IS NULL OR support_threads.customer_id=excluded.customer_id RETURNING id',[hash,user?.id||null]);
  let created=await claim();if(!created.rowCount){token=randomToken();hash=sha256(token);created=await claim();}
  const threadId=created.rows[0].id;
  await transaction(async client=>{
   const row=await client.query('SELECT status FROM support_threads WHERE id=$1 AND (customer_id IS NULL OR customer_id=$2) FOR UPDATE',[threadId,user?.id||null]);
   if(!row.rowCount)throw new HttpError(404,'Conversa não encontrada.');
   const status=row.rows[0].status;
   if(action==='request_human'){
    if(status==='bot'||status==='closed'){
     await client.query("INSERT INTO support_messages(thread_id,sender_kind,body) VALUES($1,'visitor',$2)",[threadId,'Quero falar com um atendente.']);
     await client.query("INSERT INTO support_messages(thread_id,sender_kind,body) VALUES($1,'bot',$2)",[threadId,'Sua solicitação chegou à equipe VELLOR. Um administrador poderá responder nesta conversa. Não é atendimento imediato; volte ao chat para acompanhar.']);
     await client.query("UPDATE support_threads SET status='waiting',requested_at=now(),last_message_at=now(),updated_at=now() WHERE id=$1",[threadId]);
     await client.query("INSERT INTO notifications(kind,title,payload) VALUES('support_requested',$1,$2::jsonb)",['Novo atendimento VELLOR solicitado',JSON.stringify({thread_id:threadId})]);
    }
   }else{
    const recent=await client.query("SELECT COUNT(*)::int AS count FROM support_messages WHERE thread_id=$1 AND sender_kind='visitor' AND created_at>now()-interval '3 seconds'",[threadId]);
    if(recent.rows[0].count>=2)throw new HttpError(429,'Aguarde um instante antes de enviar outra mensagem.');
    await client.query("INSERT INTO support_messages(thread_id,sender_kind,body) VALUES($1,'visitor',$2)",[threadId,message]);
    if(status==='bot'){
     const recent=await client.query('SELECT sender_kind,body FROM support_messages WHERE thread_id=$1 ORDER BY id DESC LIMIT 12',[threadId]);
     const history=recent.rows.reverse();let reply=supportReply(message,history);
     if(humanQuestion(message)){
      await client.query("UPDATE support_threads SET status='waiting',requested_at=now(),last_message_at=now(),updated_at=now() WHERE id=$1",[threadId]);
      await client.query("INSERT INTO notifications(kind,title,payload) VALUES('support_requested',$1,$2::jsonb)",['Novo atendimento VELLOR solicitado',JSON.stringify({thread_id:threadId})]);
     }else if((orderQuestion(message)&&!/(trocar|devolver|cancelar|arrepend)/i.test(message))||(/^#?\d{1,12}$/.test(message)&&history.some(m=>m.sender_kind==='visitor'&&orderQuestion(m.body)))){
      const number=orderNumber(message)||(/^#?\d{1,12}$/.test(message)?message.replace('#',''):null);
      if(!user)reply='Para proteger suas informações, entre em Minha Conta antes de consultar seu pedido. Depois, informe o número do pedido aqui.';
      else if(!number)reply='Qual é o número do seu pedido? Você pode encontrá-lo em Minha Conta > Meus pedidos. Envie apenas o número, sem dados pessoais.';
      else{
       const found=await client.query('SELECT order_number,status,payment_status,tracking_code FROM orders WHERE customer_id=$1 AND order_number=$2::bigint LIMIT 1',[user.id,number]);
       const o=found.rows[0];reply=o?'Pedido #'+o.order_number+': '+customerOrderLabel(o.status)+'. Pagamento: '+(o.status==='canceled'&&o.payment_status==='approved'?'Estorno pendente':customerPaymentLabel(o.payment_status))+'. '+(o.tracking_code?'Rastreamento: '+o.tracking_code+'. ':'')+'Consulte Minha Conta para mais detalhes ou fale com a equipe.':'Não localizei esse pedido na sua conta. Confira o número em Minha Conta ou solicite atendimento humano.';
      }
     }
     await client.query("INSERT INTO support_messages(thread_id,sender_kind,body) VALUES($1,'bot',$2)",[threadId,reply.slice(0,2000)]);
    }
    if(status==='waiting'||status==='active'){
     await client.query("INSERT INTO notifications(kind,title,payload) SELECT 'support_requested',$1,$2::jsonb WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE kind='support_requested' AND read_at IS NULL AND payload->>'thread_id'=$3)",['Nova mensagem no atendimento VELLOR',JSON.stringify({thread_id:threadId}),threadId]);
    }
    if(status==='closed'){
     await client.query("UPDATE support_threads SET status='waiting',requested_at=now(),last_message_at=now(),updated_at=now() WHERE id=$1",[threadId]);
     await client.query("INSERT INTO notifications(kind,title,payload) VALUES('support_requested',$1,$2::jsonb)",['Conversa VELLOR reaberta pelo cliente',JSON.stringify({thread_id:threadId})]);
    }else await client.query("UPDATE support_threads SET last_message_at=now(),updated_at=now() WHERE id=$1",[threadId]);
   }
  });
  const response=ok(await snapshot(hash,user?.id||null));
  response.cookies.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:AGE});
  return response;
 }catch(e){return fail(e);}
}
