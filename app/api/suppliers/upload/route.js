import {put} from '@vercel/blob';import {requireUser} from '@/lib/auth';import {sql} from '@/lib/db';import {ok,fail,originGuard,ensure} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req){try{originGuard(req);const user=await requireUser(req);ensure(user.role==='supplier','Área restrita.',403);const own=await sql("SELECT 1 FROM suppliers WHERE user_id=$1 AND status='active'",[user.id]);ensure(own.rowCount,'Conta suspensa.',403);
 ensure(process.env.BLOB_READ_WRITE_TOKEN,'Serviço de imagens indisponível.',503);
 const form=await req.formData();const file=form.get('file');ensure(file&&typeof file.arrayBuffer==='function','Imagem ausente.',400);ensure(file.size>100&&file.size<4*1024*1024,'Imagem deve ter até 4 MB.');ensure(['image/jpeg','image/png','image/webp'].includes(file.type),'Formato inválido.');
 const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';const name=`vellor/suppliers/${user.id}/${crypto.randomUUID()}.${ext}`;
 const result=await put(name,file,{access:'public',addRandomSuffix:false,contentType:file.type});return ok({url:result.url});
 }catch(e){return fail(e)}}
