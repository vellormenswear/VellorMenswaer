import {sql,transaction,audit} from '@/lib/db';import {ok,fail,body,originGuard,ensure,HttpError,email,txt} from '@/lib/http';
import {sha256,passwordHash,passwordVerify,randomToken,validPassword,needsPasswordUpgrade,DUMMY_PASSWORD_HASH} from '@/lib/security';
import {getUser,requireUser,publicUser,issueSession,revoke} from '@/lib/auth';import {sendMail} from '@/lib/email';
import {clientIp,takeLimit} from '@/lib/rate-limit';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req,{params}){try{const {action}=await params;if(action!=='me')throw new HttpError(404,'Não encontrado.');return ok({user:publicUser(await getUser(req))})}catch(e){return fail(e)}}
export async function POST(req,{params}){try{originGuard(req);const {action}=await params;const x=await body(req,16000);const ip=clientIp(req);if(action==='register'){
 await takeLimit('register-ip',ip,8,3600);
 const name=txt(x.name,120),mail=email(x.email),pw=x.password;ensure(name.length>=3&&/^\S+@\S+\.\S+$/.test(mail),'Dados de cadastro inválidos.');ensure(validPassword(pw),'Senha deve conter entre 12 e 128 caracteres.');const hash=await passwordHash(pw);
 try{const r=await sql(`INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,'customer') RETURNING id`,[name,mail,hash]);const res=ok({created:true,user:{name,email:mail,role:'customer'}},201);return await issueSession(r.rows[0].id,res,req.headers.get('user-agent')||'')}catch(e){if(e.code==='23505')throw new HttpError(409,'E-mail já cadastrado.');throw e}
 }
 if(action==='login'){
 const mail=email(x.email),password=x.password;
 await takeLimit('login-ip',ip,50,900);
 await takeLimit('login-pair',ip+'|'+mail,10,900);
 await takeLimit('login-account',mail,40,900);
 ensure(typeof password==='string'&&password.length<=128,'Credenciais inválidas.',401);
 const r=await sql('SELECT * FROM users WHERE email=$1',[mail]);const u=r.rows[0];
 const matched=await passwordVerify(password,u&&!u.suspended_at?u.password_hash:DUMMY_PASSWORD_HASH);
 if(!u||u.suspended_at||!matched)throw new HttpError(401,'Credenciais inválidas.');
 let verifiedHash=u.password_hash;
 if(needsPasswordUpgrade(verifiedHash)){
  const upgraded=await passwordHash(password);
  const changed=await sql('UPDATE users SET password_hash=$1 WHERE id=$2 AND password_hash=$3 AND suspended_at IS NULL RETURNING id',[upgraded,u.id,verifiedHash]);
  ensure(changed.rowCount,'Credenciais alteradas. Entre novamente.',401);verifiedHash=upgraded;
 }
 const res=ok({user:publicUser(u)});return await issueSession(u.id,res,req.headers.get('user-agent')||'',verifiedHash);

 }
 if(action==='logout'){const res=ok({ok:true});await revoke(req,res);return res}
 if(action==='forgot'){
 await takeLimit('forgot-ip',ip,15,3600);const mail=email(x.email);await takeLimit('forgot-account',mail,3,3600);const result=await sql('SELECT id,email FROM users WHERE email=$1 AND suspended_at IS NULL',[mail]);
 if(result.rowCount&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM){const token=randomToken();await sql("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval'30 minutes')",[result.rows[0].id,sha256(token)]);const url=new URL('/conta?reset='+encodeURIComponent(token),process.env.SITE_URL||new URL(req.url).origin);try{await sendMail(mail,'Vellor Menswear — redefinição de senha',`<p>Você solicitou a redefinição da senha.</p><p><a href="${url}">Redefinir senha (30 minutos)</a></p><p>Se não foi você, ignore esta mensagem.</p>`)}catch{console.error('Vellor: falha no envio de recuperação de senha');}}
 return ok({message:'Se o e-mail existir e o envio estiver configurado, enviaremos as instruções.'});
 }
 if(action==='reset'){
 await takeLimit('reset-ip',ip,12,900);const token=txt(x.token,200);ensure(/^[A-Za-z0-9_-]{43}$/.test(token),'Token inválido.');
 ensure(validPassword(x.password),'Senha deve conter entre 12 e 128 caracteres.');
 const tokenHash=sha256(token);const found=await sql('SELECT user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()',[tokenHash]);ensure(found.rowCount,'Link inválido ou expirado.',400);
 const hash=await passwordHash(x.password);
 await transaction(async c=>{
  const uid=found.rows[0].user_id;const user=await c.query('SELECT id FROM users WHERE id=$1 AND suspended_at IS NULL FOR UPDATE',[uid]);ensure(user.rowCount,'Link inválido ou expirado.',400);
  const t=await c.query('SELECT id FROM password_reset_tokens WHERE token_hash=$1 AND user_id=$2 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[tokenHash,uid]);ensure(t.rowCount,'Link inválido ou expirado.',400);
  await c.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[hash,uid]);
  await c.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[uid]);
  await c.query('DELETE FROM sessions WHERE user_id=$1',[uid]);
 });return ok({message:'Senha atualizada. Faça login novamente.'});

 }
 if(action==='profile'){
 const user=await requireUser(req);const full_name=txt(x.name,120),phone=txt(x.phone,24);ensure(full_name.length>=3,'Nome inválido.');await sql('UPDATE users SET full_name=$1,phone=$2,updated_at=now() WHERE id=$3',[full_name,phone,user.id]);return ok({updated:true});
 }
 if(action==='password'){
 const user=await requireUser(req);await takeLimit('password-user',user.id,8,900);ensure(validPassword(x.next),'Senha deve conter entre 12 e 128 caracteres.');const r=await sql('SELECT password_hash FROM users WHERE id=$1',[user.id]);ensure(await passwordVerify(String(x.current||''),r.rows[0].password_hash),'Senha atual incorreta.',403);const hash=await passwordHash(x.next);await transaction(async c=>{const updated=await c.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2 AND password_hash=$3 RETURNING id',[hash,user.id,r.rows[0].password_hash]);ensure(updated.rowCount,'Senha alterada. Entre novamente.',409);await c.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[user.id]);await c.query('DELETE FROM sessions WHERE user_id=$1',[user.id]);});const res=ok({updated:true});await revoke(req,res);return res;
 }
 throw new HttpError(404,'Ação desconhecida.');
 }catch(e){return fail(e)}}
