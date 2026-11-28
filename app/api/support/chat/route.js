import {sql,transaction} from '@/lib/db';
import {limitRequest} from '@/lib/rate-limit';
import {getUser} from '@/lib/auth';
import {randomToken,sha256} from '@/lib/security';
import {ok,fail,body,originGuard,ensure,HttpError} from '@/lib/http';
import {customerOrderLabel,customerPaymentLabel} from '@/lib/customer-order-status.mjs';
import {supportReply,orderQuestion,orderNumber,humanQuestion,orderActionQuestion} from '@/lib/support-faq.mjs';
import {SUMMARY_PROMPT,normalizeSupport,classifySupport,productIntent,productAnswer,orderContext} from '@/lib/support-intelligence.mjs';
import {CATALOG_FROM,CATALOG_WHERE} from '@/lib/catalog-query.mjs';
import {CAMPAIGN_JOIN,CAMPAIGN_PRICE} from '@/lib/campaign-pricing.mjs';
import {purgeSupportHistory} from '@/lib/support-retention.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const COOKIE='vellor_support_session';
const AGE=60*60*24*30;
function tokenOf(req){const c=req.headers.get('cookie')||'';const t=c.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';return /^[A-Za-z0-9_-]{43}$/.test(t)?t:'';}
const AI_OWNER="(customer_id=$1::uuid OR ($1::uuid IS NULL AND customer_id IS NULL AND visitor_token_hash=$2))";
const HUMAN_OWNER="(t.customer_id=$1::uuid OR ($1::uuid IS NULL AND t.customer_id IS NULL AND COALESCE(t.guest_owner_hash,t.visitor_token_hash)=$2))";
const HUMAN_VALID="t.status<>'bot' AND COALESCE(t.requested_at,t.created_at)>now()-interval '30 days'";
function aiMessage(c,userId,hash,kind,body){return c.query('INSERT INTO support_ai_messages(customer_id,visitor_token_hash,sender_kind,body) VALUES($1,$2,$3,$4)',[userId,userId?null:hash,kind,body]);}
async function snapshot(c,userId,hash){
 if(!userId&&!hash)return {status:'bot',messages:[],survey:null};
 const args=[userId,hash];
 const ai=await c.query("SELECT id,sender_kind,body,created_at FROM support_ai_messages WHERE "+AI_OWNER+" AND created_at>now()-interval '24 hours' ORDER BY id DESC LIMIT 100",args);
 const threads=await c.query("SELECT t.id,t.status,t.title,t.rating,t.closed_at FROM support_threads t WHERE "+HUMAN_OWNER+" AND "+HUMAN_VALID+" ORDER BY CASE WHEN t.status IN ('waiting','active') THEN 0 ELSE 1 END,t.last_message_at DESC LIMIT 100",args);
 const active=threads.rows.find(t=>['waiting','active'].includes(t.status));
 const survey=threads.rows.find(t=>t.status==='closed'&&t.rating===null&&t.closed_at);
 const human=await c.query("SELECT m.id,m.sender_kind,m.body,m.created_at,u.full_name AS sender_name,t.id AS thread_id FROM support_messages m JOIN support_threads t ON t.id=m.thread_id LEFT JOIN users u ON u.id=m.sender_user_id WHERE "+HUMAN_OWNER+" AND "+HUMAN_VALID+" AND m.created_at>now()-interval '30 days' AND (m.sender_kind<>'bot' OR m.created_at>now()-interval '24 hours') ORDER BY m.id DESC LIMIT 100",args);
 const messages=[...ai.rows.map(m=>({...m,id:'ai-'+m.id})),...human.rows.map(m=>({...m,id:'human-'+m.id}))].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)||a.id.localeCompare(b.id,undefined,{numeric:true}));
 const awaiting=ai.rows[0]?.sender_kind==='bot'&&ai.rows[0]?.body===SUMMARY_PROMPT;
 return {status:active?.status||(awaiting?'summary':'bot'),messages,survey:survey?{id:survey.id,title:survey.title}:null};
}
async function claimGuest(c,userId,hash){
 if(!userId||!hash)return;
 await c.query("UPDATE support_ai_messages SET customer_id=$1,visitor_token_hash=NULL WHERE customer_id IS NULL AND visitor_token_hash=$2 AND created_at>now()-interval '24 hours'",[userId,hash]);
 await c.query("UPDATE support_threads SET customer_id=$1,guest_owner_hash=NULL WHERE customer_id IS NULL AND COALESCE(guest_owner_hash,visitor_token_hash)=$2 AND status<>'bot'",[userId,hash]);
}
async function catalogReply(c,intent){
 const n=s=>"translate(lower("+s+"),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')";
 const text=n("concat_ws(' ',p.name,v.label,cat.name)");
 const query="SELECT p.name,p.slug,v.label AS variant,v.sizes,("+CAMPAIGN_PRICE+") AS price_cents "+CATALOG_FROM+" "+CAMPAIGN_JOIN+" LEFT JOIN categories cat ON cat.id=p.category_id WHERE "+CATALOG_WHERE+" AND ($1::text IS NULL OR p.department=$1) AND NOT EXISTS(SELECT 1 FROM unnest($2::text[]) AS term(value) WHERE position(term.value in "+text+")=0) AND ($3='' OR position($3 in "+n("v.label")+")>0 OR ($3='preto' AND position('preta' in "+n("v.label")+")>0) OR ($3='branco' AND position('branca' in "+n("v.label")+")>0) OR ($3='vermelho' AND position('vermelha' in "+n("v.label")+")>0)) AND ($4='' OR EXISTS(SELECT 1 FROM unnest(v.sizes) AS size(value) WHERE upper(size.value)=$4)) AND ($5::int IS NULL OR ("+CAMPAIGN_PRICE+")<=$5) ORDER BY price_cents,p.name,v.label LIMIT 5";
 const r=await c.query(query,[intent.department,intent.tokens,intent.color,intent.size,intent.maxCents]);return productAnswer(r.rows);
}
async function automaticReply(c,message,history,user){
 const q=normalizeSupport(message);
 const number=orderContext(q,history,orderNumber,orderQuestion);
 if(!orderActionQuestion(q)&&(orderQuestion(q)||number)){
  if(!user)return 'Para proteger suas informações, entre em Minha Conta antes de consultar seu pedido. Depois, informe o número do pedido aqui.';
  if(!number)return 'Qual é o número do seu pedido? Você pode encontrá-lo em Minha Conta > Meus pedidos. Envie apenas o número, sem dados pessoais.';
  const found=await c.query('SELECT order_number,status,payment_status,tracking_code FROM orders WHERE customer_id=$1 AND order_number=$2::bigint LIMIT 1',[user.id,number]);
  const o=found.rows[0];
  return o?'Pedido #'+o.order_number+': '+customerOrderLabel(o.status)+'. Pagamento: '+(o.status==='canceled'&&o.payment_status==='approved'?'Estorno pendente':customerPaymentLabel(o.payment_status))+'. '+(o.tracking_code?'Rastreamento: '+o.tracking_code+'. ':'')+'Consulte Minha Conta para mais detalhes ou fale com a equipe.':'Não localizei esse pedido na sua conta. Confira o número em Minha Conta ou solicite atendimento humano.';
 }
 const intent=productIntent(q,history);
 if(intent)return catalogReply(c,intent);
 return supportReply(q,history.map(m=>({...m,body:normalizeSupport(m.body)})));
}
export async function GET(req){
 try{
  const u=await getUser(req),token=tokenOf(req),hash=token?sha256(token):null;
  if(!u&&!hash)return ok({status:'bot',messages:[],survey:null});
  const data=await transaction(async c=>{
   if(u&&hash){await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['support:'+u.id]);await claimGuest(c,u.id,hash);}
   return snapshot(c,u?.id||null,hash);
  });
  return ok(data);
 }catch(e){return fail(e);}
}
export async function POST(req){
 try{
  originGuard(req);const x=await body(req,6000),action=x?.action;
  ensure(['message','request_human','rating'].includes(action),'Ação inválida.');
  const message=typeof x.message==='string'?x.message.trim():'';
  if(action==='message')ensure(message.length>0&&message.length<=1200,'A mensagem deve ter até 1.200 caracteres.');
  if(action==='rating'){ensure(typeof x.thread_id==='string'&&/^[0-9a-f-]{36}$/i.test(x.thread_id)&&Number.isInteger(x.rating)&&x.rating>=1&&x.rating<=5,'Avaliação inválida.');ensure(message.length<=1200,'O comentário deve ter até 1.200 caracteres.');}
  const token=tokenOf(req)||randomToken(),hash=sha256(token),user=await getUser(req),userId=user?.id||null;
  await limitRequest(req,'support',{identity:userId});
  const data=await transaction(async c=>{
   // Serialize cross-device sends and requests for the same account.
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['support:'+(userId||hash)]);
   await claimGuest(c,userId,hash);
   const args=[userId,hash];
   if(action==='rating'){
    const r=await c.query("UPDATE support_threads t SET rating=$4,rating_comment=$5,rated_at=now() WHERE "+HUMAN_OWNER+" AND "+HUMAN_VALID+" AND t.id=$3::uuid AND t.status='closed' AND t.rating IS NULL RETURNING id",[...args,x.thread_id,x.rating,message||null]);
    ensure(r.rowCount,'Atendimento não encontrado ou já avaliado.',409);return snapshot(c,...args);
   }
   const h=await c.query("SELECT t.id,t.status FROM support_threads t WHERE "+HUMAN_OWNER+" AND "+HUMAN_VALID+" AND t.status IN ('waiting','active') ORDER BY t.last_message_at DESC LIMIT 1 FOR UPDATE",args);
   const thread=h.rows[0];
   if(thread){
    if(action==='message'){
     const recent=await c.query("SELECT count(*)::int AS n FROM support_messages WHERE thread_id=$1 AND sender_kind='visitor' AND created_at>now()-interval '3 seconds'",[thread.id]);
     ensure(recent.rows[0].n<2,'Aguarde um instante antes de enviar outra mensagem.',429);
     await c.query("INSERT INTO support_messages(thread_id,sender_kind,body,sender_user_id) VALUES($1,'visitor',$2,$3)",[thread.id,message,userId]);
     await c.query("UPDATE support_threads SET last_message_at=now(),updated_at=now() WHERE id=$1",[thread.id]);
     await c.query("INSERT INTO notifications(kind,title,payload) SELECT 'support_requested',$1,$2::jsonb WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE kind='support_requested' AND read_at IS NULL AND payload->>'thread_id'=$3)",['Nova mensagem no atendimento VELLOR',JSON.stringify({thread_id:thread.id}),thread.id]);
    }
    return snapshot(c,...args);
   }
   const last=await c.query("SELECT sender_kind,body FROM support_ai_messages WHERE "+AI_OWNER+" AND created_at>now()-interval '24 hours' ORDER BY id DESC LIMIT 12",args);
   const awaiting=last.rows[0]?.sender_kind==='bot'&&last.rows[0]?.body===SUMMARY_PROMPT;
   if(action==='request_human'||(!awaiting&&humanQuestion(normalizeSupport(message)))){
    if(!awaiting){if(action==='message')await aiMessage(c,userId,hash,'visitor',message);await aiMessage(c,userId,hash,'bot',SUMMARY_PROMPT);}
    return snapshot(c,...args);
   }
   if(awaiting){
    const title=classifySupport(message);
    const created=await c.query("INSERT INTO support_threads(visitor_token_hash,guest_owner_hash,customer_id,status,title,requested_at) VALUES($1,$2,$3,'waiting',$4,now()) RETURNING id",[sha256(randomToken()),userId?null:hash,userId,title]);
    const id=created.rows[0].id;
    await c.query("INSERT INTO support_messages(thread_id,sender_kind,body,sender_user_id) VALUES($1,'visitor',$2,$3)",[id,message,userId]);
    // Neutral bot receipt stays in AI history; the human summary exists only in the human table.
    await aiMessage(c,userId,hash,'bot','Sua solicitação foi enviada à equipe VELLOR. Acompanhe a resposta por aqui.');
    await c.query("INSERT INTO notifications(kind,title,payload) VALUES('support_requested',$1,$2::jsonb)",[title,JSON.stringify({thread_id:id})]);
    return snapshot(c,...args);
   }
   const rate=await c.query("SELECT count(*)::int AS n FROM support_ai_messages WHERE "+AI_OWNER+" AND sender_kind='visitor' AND created_at>now()-interval '3 seconds'",args);
   ensure(rate.rows[0].n<2,'Aguarde um instante antes de enviar outra mensagem.',429);
   await aiMessage(c,userId,hash,'visitor',message);
   const reply=await automaticReply(c,message,[...last.rows].reverse().concat({sender_kind:'visitor',body:message}),user);
   await aiMessage(c,userId,hash,'bot',reply.slice(0,2000));
   return snapshot(c,...args);
  });
  const response=ok(data);
  response.cookies.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:AGE});
  return response;
 }catch(e){return fail(e);}
}
