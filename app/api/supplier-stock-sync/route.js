import {body,originGuard,ok,fail,HttpError} from '@/lib/http';
import {syncSelectedSupplierStock} from '@/lib/supplier-stock-sync';
import {GET as catalog} from '../catalog/route';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
export async function POST(req){try{
 originGuard(req);const x=await body(req,2048);
 if(typeof x.slug!=='string'||!x.slug||x.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.slug))throw new HttpError(400,'Produto inválido.');
 await syncSelectedSupplierStock(x.slug);
 const url=new URL('/api/catalog',req.url);url.searchParams.set('slug',x.slug);
 return await catalog(new Request(url));
 }catch(e){return fail(e)}}
