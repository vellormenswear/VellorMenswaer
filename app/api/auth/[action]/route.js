import {sql,transaction,audit} from '@/lib/db';import {ok,fail,body,originGuard,ensure,HttpError,email,txt} from '@/lib/http';
import {sha256,passwordHash,passwordVerify,randomToken} from '@/lib/security';
import {limitRequest} from '@/lib/rate-limit';
import {generateRecoveryCode,validRecoveryCode,validRecoveryChallenge,recoveryCodeHash,recoveryEmail} from '@/lib/password-recovery.mjs';
import {getUser,requireUser,publicUser,issueSession,revoke} from '@/lib/auth';import {sendMail,emailConfigured} from '@/lib/email';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req,{params}){try{const {action}=await params;if(action!=='me')throw new HttpError(404,'Não encontrado.');return ok({user:publicUser(await getUser(req))})}catch(e){return fail(e)}}
export async function POST(req,{params}){try{originGuard(req);const {action}=await params;const x=await body(req);if(action==='register'){
 await limitRequest(req,'register',{identity:email(x.email)});
 const name=txt(x.name,120),mail=email(x.email),pw=x.password;ensure(name.length>=3&&/^\S+@\S+\.\S+$/.test(mail),'Dados de cadastro inválidos.');ensure(typeof pw==='string'&&pw.length>=12&&pw.length<=128,'Senha deve conter entre 12 e 128 caracteres.');const hash=await passwordHash(pw);
 try{const r=await sql(`INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,'customer') RETURNING id`,[name,mail,hash]);const res=ok({created:true,user:{name,email:mail,role:'customer'}},201);return await issueSession(r.rows[0].id,res,req.headers.get('user-agent')||'')}catch(e){if(e.code==='23505')throw new HttpError(409,'E-mail já cadastrado.');throw e}
 }
 if(action==='login'){
 const mail=email(x.email),password=typeof x.password==='string'?x.password:'';
 await limitRequest(req,'login',{identity:mail});
 const r=await sql('SELECT * FROM users WHERE email=$1 AND launch_archived_at IS NULL',[mail]);const u=r.rows[0];const valid=u&&!u.suspended_at&&await passwordVerify(password,u.password_hash);
 if(!valid)throw new HttpError(401,'Credenciais inválidas.');
 const res=ok({user:publicUser(u)});return await issueSession(u.id,res,req.headers.get('user-agent')||'');
 }
 if(action==='logout'){const res=ok({ok:true});await revoke(req,res);return res}
 if(action==='forgot'){
 const mail=email(x.email);await limitRequest(req,'forgot',{identity:mail});ensure(/^\S+@\S+\.\S+$/.test(mail),'E-mail inválido.');
 if(!emailConfigured())throw new HttpError(503,'Recuperação temporariamente indisponível. Tente novamente mais tarde.');
 const challenge=randomToken(),code=generateRecoveryCode(),tokenHash=recoveryCodeHash(mail,challenge,code);
 const issued=await transaction(async c=>{const result=await c.query('SELECT id,email FROM users WHERE email=$1 AND suspended_at IS NULL AND launch_archived_at IS NULL FOR UPDATE',[mail]);if(!result.rowCount)return null;await c.query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval'30 minutes')",[result.rows[0].id,tokenHash]);return result.rows[0]});
 if(issued){try{await sendMail(issued.email,'VellorWear — código de recuperação de senha',recoveryEmail(code))}catch{console.error('Vellor password recovery: email delivery failed');}}
 return ok({challenge,message:'Se o e-mail estiver cadastrado, você receberá um código de 6 dígitos.'});
 }
 if(action==='reset'){
 const mail=email(x.email),legacy=typeof x.token==='string'&&!x.challenge&&!x.code;
 await limitRequest(req,'reset',{identity:legacy?undefined:mail});
 const invalid='Código inválido ou expirado.';
 let tokenHash;
 if(legacy){const token=txt(x.token,200);ensure(validRecoveryChallenge(token),'Link inválido ou expirado.');tokenHash=sha256(token);}
 else{ensure(validRecoveryCode(x.code)&&validRecoveryChallenge(x.challenge)&&/^\S+@\S+\.\S+$/.test(mail),invalid);if(!emailConfigured())throw new HttpError(503,'Recuperação temporariamente indisponível.');tokenHash=recoveryCodeHash(mail,x.challenge,x.code);}
 ensure(typeof x.password==='string'&&x.password.length>=12&&x.password.length<=128,'Senha deve conter entre 12 e 128 caracteres.');
 const candidate=await sql('SELECT t.user_id FROM password_reset_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>now() AND ($2::text IS NULL OR u.email=$2) AND u.suspended_at IS NULL AND u.launch_archived_at IS NULL',[tokenHash,legacy?null:mail]);
 ensure(candidate.rowCount,legacy?'Link inválido ou expirado.':invalid,400);
 const hash=await passwordHash(x.password);const userId=candidate.rows[0].user_id;
 await transaction(async c=>{const owner=await c.query('SELECT id,email FROM users WHERE id=$1 AND suspended_at IS NULL AND launch_archived_at IS NULL FOR UPDATE',[userId]);ensure(owner.rowCount&&(legacy||owner.rows[0].email===mail),invalid,400);const t=await c.query('SELECT id FROM password_reset_tokens WHERE token_hash=$1 AND user_id=$2 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[tokenHash,userId]);ensure(t.rowCount,invalid,400);await c.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[hash,userId]);await c.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[userId]);await c.query('DELETE FROM sessions WHERE user_id=$1',[userId]);});
 return ok({message:'Senha atualizada. Faça login novamente.'});
 }
 if(action==='profile'){
 const user=await requireUser(req);const full_name=txt(x.name,120),phone=txt(x.phone,24);ensure(full_name.length>=3,'Nome inválido.');await sql('UPDATE users SET full_name=$1,phone=$2,updated_at=now() WHERE id=$3',[full_name,phone,user.id]);return ok({updated:true});
 }
 if(action==='password'){
 const user=await requireUser(req);ensure(typeof x.next==='string'&&x.next.length>=12&&x.next.length<=128,'Senha deve conter entre 12 e 128 caracteres.');const hash=await passwordHash(x.next);await transaction(async c=>{const r=await c.query('SELECT password_hash FROM users WHERE id=$1 AND suspended_at IS NULL AND launch_archived_at IS NULL FOR UPDATE',[user.id]);ensure(r.rowCount&&await passwordVerify(String(x.current||''),r.rows[0].password_hash),'Senha atual incorreta.',403);await c.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[hash,user.id]);await c.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[user.id]);await c.query('DELETE FROM sessions WHERE user_id=$1',[user.id]);});const res=ok({updated:true});await revoke(req,res);return res;
 }
 throw new HttpError(404,'Ação desconhecida.');
 }catch(e){return fail(e)}}
