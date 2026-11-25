import {sql,transaction,audit} from '@/lib/db';import {ok,fail,body,originGuard,ensure,HttpError,email,txt} from '@/lib/http';
import {sha256,passwordHash,passwordVerify,randomToken} from '@/lib/security';
import {getUser,requireUser,publicUser,issueSession,revoke} from '@/lib/auth';import {sendMail} from '@/lib/email';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req,{params}){try{const {action}=await params;if(action!=='me')throw new HttpError(404,'Não encontrado.');return ok({user:publicUser(await getUser(req))})}catch(e){return fail(e)}}
export async function POST(req,{params}){try{originGuard(req);const {action}=await params;const x=await body(req);if(action==='register'){
 const name=txt(x.name,120),mail=email(x.email),pw=x.password;ensure(name.length>=3&&/^\S+@\S+\.\S+$/.test(mail),'Dados de cadastro inválidos.');ensure(typeof pw==='string'&&pw.length>=12&&pw.length<=128,'Senha deve conter entre 12 e 128 caracteres.');const hash=await passwordHash(pw);
 try{const r=await sql(`INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,'customer') RETURNING id`,[name,mail,hash]);const res=ok({created:true,user:{name,email:mail,role:'customer'}},201);return await issueSession(r.rows[0].id,res,req.headers.get('user-agent')||'')}catch(e){if(e.code==='23505')throw new HttpError(409,'E-mail já cadastrado.');throw e}
 }
 if(action==='login'){
 const mail=email(x.email),password=String(x.password||''),key=sha256(mail+'|'+(req.headers.get('x-forwarded-for')||'').split(',')[0]);
 // Sem limite de tentativas ou bloqueio temporal da conta. Atrasos progressivos e curtos
 // desaceleram tentativas automatizadas sem impedir novos logins legítimos.
 const attempts=await sql('SELECT failures,updated_at FROM auth_attempts WHERE key_hash=$1',[key]);
 const previous=attempts.rows[0];
 const recent=previous&&Date.now()-new Date(previous.updated_at).getTime()<15*60*1000;
 const failedCount=recent?Math.max(0,Number(previous.failures)||0):0;
 if(failedCount>=4)await new Promise(resolve=>setTimeout(resolve,Math.min(1600,200*Math.pow(2,Math.min(3,failedCount-4)))));
 const r=await sql('SELECT * FROM users WHERE email=$1',[mail]);const u=r.rows[0];const valid=u&&!u.suspended_at&&await passwordVerify(password,u.password_hash);
 if(!valid){await sql(`INSERT INTO auth_attempts(key_hash,failures,locked_until) VALUES($1,1,NULL) ON CONFLICT(key_hash) DO UPDATE SET failures=CASE WHEN auth_attempts.updated_at<now()-interval'15 minutes' THEN 1 ELSE auth_attempts.failures+1 END, updated_at=now(),locked_until=NULL`,[key]);throw new HttpError(401,'Credenciais inválidas.');}
 await sql('DELETE FROM auth_attempts WHERE key_hash=$1',[key]);const res=ok({user:publicUser(u)});return await issueSession(u.id,res,req.headers.get('user-agent')||'');
 }
 if(action==='logout'){const res=ok({ok:true});await revoke(req,res);return res}
 if(action==='forgot'){
 const mail=email(x.email);const token=randomToken();
 const issued=process.env.RESEND_API_KEY&&process.env.EMAIL_FROM?await transaction(async c=>{const result=await c.query('SELECT id FROM users WHERE email=$1 AND suspended_at IS NULL AND launch_archived_at IS NULL FOR UPDATE',[mail]);if(!result.rowCount)return false;await c.query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval'30 minutes')",[result.rows[0].id,sha256(token)]);return true}):false;
 if(issued){const url=new URL('/conta?reset='+encodeURIComponent(token),process.env.SITE_URL||new URL(req.url).origin);await sendMail(mail,'Vellor Menswear — redefinição de senha',`<p>Você solicitou a redefinição da senha.</p><p><a href="${url}">Redefinir senha (30 minutos)</a></p><p>Se não foi você, ignore esta mensagem.</p>`)}
 return ok({message:'Se o e-mail existir e o envio estiver configurado, enviaremos as instruções.'});
 }
 if(action==='reset'){
 const token=txt(x.token,200);ensure(/^[A-Za-z0-9_-]{43}$/.test(token),'Token inválido.');ensure(typeof x.password==='string'&&x.password.length>=12&&x.password.length<=128,'Senha deve conter entre 12 e 128 caracteres.');const tokenHash=sha256(token);const candidate=await sql('SELECT user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()',[tokenHash]);ensure(candidate.rowCount,'Link inválido ou expirado.',400);const hash=await passwordHash(x.password);const userId=candidate.rows[0].user_id;await transaction(async c=>{const owner=await c.query('SELECT id FROM users WHERE id=$1 AND suspended_at IS NULL AND launch_archived_at IS NULL FOR UPDATE',[userId]);ensure(owner.rowCount,'Link inválido ou expirado.',400);const t=await c.query('SELECT id FROM password_reset_tokens WHERE token_hash=$1 AND user_id=$2 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[tokenHash,userId]);ensure(t.rowCount,'Link inválido ou expirado.',400);await c.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[hash,userId]);await c.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[userId]);await c.query('DELETE FROM sessions WHERE user_id=$1',[userId]);});return ok({message:'Senha atualizada. Faça login novamente.'});
 }
 if(action==='profile'){
 const user=await requireUser(req);const full_name=txt(x.name,120),phone=txt(x.phone,24);ensure(full_name.length>=3,'Nome inválido.');await sql('UPDATE users SET full_name=$1,phone=$2,updated_at=now() WHERE id=$3',[full_name,phone,user.id]);return ok({updated:true});
 }
 if(action==='password'){
 const user=await requireUser(req);ensure(typeof x.next==='string'&&x.next.length>=12&&x.next.length<=128,'Senha deve conter entre 12 e 128 caracteres.');const hash=await passwordHash(x.next);await transaction(async c=>{const r=await c.query('SELECT password_hash FROM users WHERE id=$1 AND suspended_at IS NULL AND launch_archived_at IS NULL FOR UPDATE',[user.id]);ensure(r.rowCount&&await passwordVerify(String(x.current||''),r.rows[0].password_hash),'Senha atual incorreta.',403);await c.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[hash,user.id]);await c.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[user.id]);await c.query('DELETE FROM sessions WHERE user_id=$1',[user.id]);});const res=ok({updated:true});await revoke(req,res);return res;
 }
 throw new HttpError(404,'Ação desconhecida.');
 }catch(e){return fail(e)}}
