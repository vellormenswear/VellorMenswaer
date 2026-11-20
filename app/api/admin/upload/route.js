import {put} from '@vercel/blob';import {requireRole} from '@/lib/auth';import {ok,fail,originGuard,ensure,HttpError} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req){try{originGuard(req);await requireRole(req,['admin','super_admin']);ensure(process.env.BLOB_READ_WRITE_TOKEN,'Configure BLOB_READ_WRITE_TOKEN na Vercel.',503);
 const form=await req.formData();const f=form.get('file');ensure(f&&typeof f.arrayBuffer==='function','Arquivo ausente.');ensure(f.size>100&&f.size<4*1024*1024,'Imagem deve ter até 4 MB.');ensure(['image/jpeg','image/png','image/webp'].includes(f.type),'Tipo de imagem não permitido.');
 const ext=f.type==='image/png'?'png':f.type==='image/webp'?'webp':'jpg';const name=`pg-goston/products/${crypto.randomUUID()}.${ext}`;
 const b=await put(name,f,{access:'public',addRandomSuffix:false,contentType:f.type});return ok({url:b.url});}catch(e){return fail(e)}}
