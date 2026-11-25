import {put} from '@vercel/blob';import {requireUser} from '@/lib/auth';import {sql} from '@/lib/db';import {ok,fail,originGuard,ensure} from '@/lib/http';
import {validateImage} from '@/lib/image-validation';
export const runtime='nodejs';
export async function POST(req){try{originGuard(req);const user=await requireUser(req);ensure(user.role==='supplier','Área restrita.',403);const own=await sql("SELECT 1 FROM suppliers WHERE user_id=$1 AND status='active'",[user.id]);ensure(own.rowCount,'Conta suspensa.',403);
 ensure(process.env.BLOB_READ_WRITE_TOKEN,'Serviço de imagens indisponível.',503);
 const form=await req.formData();const file=form.get('file');const ext=await validateImage(file);const name=`vellor/suppliers/${user.id}/${crypto.randomUUID()}.${ext}`;
 const result=await put(name,file,{access:'public',addRandomSuffix:false,contentType:file.type});return ok({url:result.url});
 }catch(e){return fail(e)}}
