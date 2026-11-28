import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {body,originGuard,ensure,ok,fail,HttpError} from '@/lib/http';
import {readSupplierProduct} from '@/lib/read-supplier-product.mjs';
import {browserProductSnapshot} from '@/lib/supplier-browser-capture.mjs';
import {logImportFailure} from '@/lib/supplier-import-errors.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
export async function POST(req){try{
 originGuard(req);const user=await requireRole(req,['admin','super_admin','supplier']);
 if(user.role==='supplier'){const r=await sql("SELECT 1 FROM suppliers WHERE user_id=$1 AND status='active' AND launch_archived_at IS NULL",[user.id]);ensure(r.rowCount,'Fornecedor não habilitado.',403)}
 const x=await body(req,100000);
 try{const result=x.snapshot===undefined?await readSupplierProduct(x.url):browserProductSnapshot(x.snapshot,x.url);if(result.product.variants_incomplete)console.info('[supplier-import]',JSON.stringify({stage:'import',code:'PARTIAL_VARIANTS'}));return ok(result)}catch(e){const detail=logImportFailure('import',e);return ok({error:detail.message,code:detail.code,...(detail.status?{supplier_status:detail.status}:{})},422)}
 }catch(e){return fail(e)}}
