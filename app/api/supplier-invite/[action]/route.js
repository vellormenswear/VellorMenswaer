import {createSupplierAccount} from '@/lib/supplier-registration';
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
  const account=await createSupplierAccount(c,{name,mail,hashed,phone:txt(x.phone,30),business,document,address:txt(x.address,600),pix});
  await c.query('UPDATE supplier_invites SET used_at=now(),used_by=$1 WHERE id=$2',[account.user_id,inv.id]);return account;
 });const res=ok({created:true,redirect:'/fornecedor'},201);return issueSession(result.user_id,res,req.headers.get('user-agent')||'');
 }catch(e){return fail(e)}}
