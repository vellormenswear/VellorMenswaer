import {sql,transaction} from '@/lib/db';import {ok,fail,body,originGuard,email,txt,ensure,HttpError} from '@/lib/http';
import {sha256,passwordHash} from '@/lib/security';import {issueSession} from '@/lib/auth';import {parseSupplierPix} from '@/lib/supplier-pix.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req,{params}){try{originGuard(req);const {action}=await params;ensure(action==='accept','Recurso não encontrado.',404);const x=await body(req);
 const mail=email(x.email),name=txt(x.name,120),business=txt(x.business_name,160),document=txt(x.document,20).replace(/\D/g,''),token=txt(x.token,200),pix=parseSupplierPix(x);
 ensure(/^\S+@\S+\.\S+$/.test(mail)&&name.length>=3&&business.length>=3&&[11,14].includes(document.length),'Dados obrigatórios inválidos.');ensure(pix,'Informe uma chave Pix válida e o nome do titular da conta para receber seus pagamentos.',400);const hashed=await passwordHash(x.password);
 const result=await transaction(async c=>{
  const r=await c.query('SELECT * FROM supplier_invites WHERE token_hash=$1 FOR UPDATE',[sha256(token)]);ensure(r.rowCount,'Convite não encontrado.',404);const inv=r.rows[0];
  ensure((!inv.email||inv.email===mail)&&inv.revoked_at===null&&inv.used_at===null&&new Date(inv.expires_at)>new Date(),'Convite vencido, utilizado ou associado a outro e-mail.',409);
  const exists=await c.query('SELECT id FROM users WHERE email=$1',[mail]);ensure(!exists.rowCount,'Já existe uma conta com esse e-mail. Use outro convite.',409);
  const u=await c.query("INSERT INTO users(full_name,email,password_hash,phone,role) VALUES($1,$2,$3,$4,'supplier') RETURNING id",[name,mail,hashed,txt(x.phone,30)]);
  const s=await c.query('INSERT INTO suppliers(user_id,business_name,document_number,address_text) VALUES($1,$2,$3,$4) RETURNING id',[u.rows[0].id,business,document,txt(x.address,600)]);
   await c.query('INSERT INTO supplier_pix_accounts(supplier_id,pix_type,pix_key,holder_name) VALUES($1,$2,$3,$4)',
    [s.rows[0].id,pix.pix_type,pix.pix_key,pix.holder_name]);
  await c.query('UPDATE supplier_invites SET used_at=now(),used_by=$1 WHERE id=$2',[u.rows[0].id,inv.id]);return {user_id:u.rows[0].id,supplier_id:s.rows[0].id};
 });const res=ok({created:true,redirect:'/fornecedor'},201);return issueSession(result.user_id,res,req.headers.get('user-agent')||'');
 }catch(e){return fail(e)}}
