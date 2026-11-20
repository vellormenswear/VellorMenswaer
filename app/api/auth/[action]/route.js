import {sql,transaction,audit} from '@/lib/db';import {ok,fail,body,originGuard,ensure,HttpError,email,txt} from '@/lib/http';
import {sha256,passwordHash,passwordVerify,randomToken} from '@/lib/security';
import {getUser,requireUser,publicUser,issueSession,revoke} from '@/lib/auth';import {sendMail} from '@/lib/email';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req,{params}){try{const {action}=await params;if(action!=='me')throw new HttpError(404,'Não encontrado.');return ok({user:publicUser(await getUser(req))})}catch(e){return fail(e)}}
export async function POST(req,{params}){try{originGuard(req);const {action}=await params;const x=await body(req);if(action==='register'){
 const name=txt(x.name,120),mail=email(x.email),pw=x.password;ensure(name.length>=3&&/^\S+@\S+\.\S+$/.test(mail),'Dados de cadastro inválidos.');const hash=await passwordHash(pw);
 try{const r=await sql(`INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,'customer') RETURNING id`,[name,mail,hash]);const res=ok({created:true,user:{name,email:mail,role:'customer'}},201);return await issueSession(r.rows[0].id,res,req.headers.get('user-agent')||'')}catch(e){if(e.code==='23505')throw new HttpError(409,'E-mail já cadastrado.');throw e}
 }
 if(action==='login'){
 const mail=email(x.email),password=String(x.password||''),key=sha256(mail+'|'+(req.headers.get('x-forwarded-for')||'').split(',')[0]);
 const attempts=await sql('SELECT failures,locked_until FROM auth_attempts WHERE key_hash=$1',[key]);if(attempts.rows[0]?.locked_until&&new Date(attempts.rows[0].locked_until)>new Date())throw new HttpError(429,'Muitas tentativas. Tente mais tarde.');
 const r=await sql('SELECT * FROM users WHERE email=$1',[mail]);const u=r.rows[0];const valid=u&&!u.suspended_at&&await passwordVerify(password,u.password_hash);
 if(!valid){await sql(`INSERT INTO auth_attempts(key_hash,failures,locked_until) VALUES($1,1,NULL) ON CONFLICT(key_hash) DO UPDATE SET failures=CASE WHEN auth_attempts.updated_at<now()-interval'15 minutes' THEN 1 ELSE auth_attempts.failures+1 END, updated_at=now(),locked_until=CASE WHEN auth_attempts.failures>=5 THEN now()+interval'15 minutes' ELSE NULL END`,[key]);throw new HttpError(401,'Credenciais inválidas.');}
 await sql('DELETE FROM auth_attempts WHERE key_hash=$1',[key]);const res=ok({user:publicUser(u)});return await issueSession(u.id,res,req.headers.get('user-agent')||'');
 }
 if(action==='logout'){const res=ok({ok:true});await revoke(req,res);return res}
 if(action==='forgot'){
 const mail=email(x.email);const result=await sql('SELECT id,email FROM users WHERE email=$1 AND suspended_at IS NULL',[mail]);
 if(result.rowCount&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM){const token=randomToken();await sql("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval'30 minutes')",[result.rows[0].id,sha256(token)]);const url=new URL('/conta?reset='+encodeURIComponent(token),process.env.SITE_URL||new URL(req.url).origin);await sendMail(mail,'Vellor Menswear — redefinição de senha',`<p>Você solicitou a redefinição da senha.</p><p><a href="${url}">Redefinir senha (30 minutos)</a></p><p>Se não foi você, ignore esta mensagem.</p>`)}
 return ok({message:'Se o e-mail existir e o envio estiver configurado, enviaremos as instruções.'});
 }
 if(action==='reset'){
 const hash=await passwordHash(x.password),token=txt(x.token,200);ensure(token.length>20,'Token inválido.');await transaction(async c=>{const t=await c.query('SELECT * FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[sha256(token)]);ensure(t.rowCount,'Link inválido ou expirado.',400);await c.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[hash,t.rows[0].user_id]);await c.query('UPDATE password_reset_tokens SET used_at=now() WHERE id=$1',[t.rows[0].id]);await c.query('DELETE FROM sessions WHERE user_id=$1',[t.rows[0].user_id]);});return ok({message:'Senha atualizada. Faça login novamente.'});
 }
 if(action==='profile'){
 const user=await requireUser(req);const full_name=txt(x.name,120),phone=txt(x.phone,24);ensure(full_name.length>=3,'Nome inválido.');await sql('UPDATE users SET full_name=$1,phone=$2,updated_at=now() WHERE id=$3',[full_name,phone,user.id]);return ok({updated:true});
 }
 if(action==='password'){
 const user=await requireUser(req);const r=await sql('SELECT password_hash FROM users WHERE id=$1',[user.id]);ensure(await passwordVerify(String(x.current||''),r.rows[0].password_hash),'Senha atual incorreta.',403);const hash=await passwordHash(x.next);await sql('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[hash,user.id]);await sql('DELETE FROM sessions WHERE user_id=$1',[user.id]);const res=ok({updated:true});await revoke(req,res);return res;
 }
 throw new HttpError(404,'Ação desconhecida.');
 }catch(e){return fail(e)}}
