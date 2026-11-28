import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {body,originGuard,ensure,ok,fail,HttpError} from '@/lib/http';
import {fetchSupplierPage} from '@/lib/supplier-public-fetch.mjs';
import {parseSupplierProduct} from '@/lib/supplier-product-import.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req){try{
 originGuard(req);const user=await requireRole(req,['admin','super_admin','supplier']);
 if(user.role==='supplier'){const r=await sql("SELECT 1 FROM suppliers WHERE user_id=$1 AND status='active' AND launch_archived_at IS NULL",[user.id]);ensure(r.rowCount,'Fornecedor não habilitado.',403)}
 const x=await body(req,4096);
 try{const page=await fetchSupplierPage(x.url);return ok({product:parseSupplierProduct(page.html,page.url),url:page.url})}catch{throw new HttpError(422,'Não foi possível importar este anúncio. Verifique o link ou preencha os dados manualmente.')}
 }catch(e){return fail(e)}}
