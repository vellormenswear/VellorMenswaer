import {put} from '@vercel/blob';import {requireRole} from '@/lib/auth';import {ok,fail,originGuard,ensure,HttpError} from '@/lib/http';
import {validateImage} from '@/lib/image-validation';
export const runtime='nodejs';
export async function POST(req){try{originGuard(req);await requireRole(req,['admin','super_admin']);ensure(process.env.BLOB_READ_WRITE_TOKEN,'Configure BLOB_READ_WRITE_TOKEN na Vercel.',503);
 const form=await req.formData();const f=form.get('file');const ext=await validateImage(f);const name=`pg-goston/products/${crypto.randomUUID()}.${ext}`;
 let b;try{b=await put(name,f,{access:'public',addRandomSuffix:false,contentType:f.type});}catch(e){console.error('Vellor upload: falha no armazenamento',e?.name);throw new HttpError(503,'Não foi possível armazenar a imagem. Tente novamente.');}return ok({url:b.url});}catch(e){return fail(e)}}
