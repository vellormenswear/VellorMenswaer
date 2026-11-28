import {createHash,timingSafeEqual} from 'node:crypto';
import {ok,fail,HttpError} from '@/lib/http';
import {syncNextSupplierStock} from '@/lib/supplier-stock-sync';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
const hash=s=>createHash('sha256').update(s).digest();
export async function POST(req){try{
 const secret=process.env.SUPPLIER_STOCK_SYNC_SECRET;
 if(!secret||!timingSafeEqual(hash(req.headers.get('authorization')||''),hash('Bearer '+secret)))throw new HttpError(401,'Não autorizado.');
 return ok(await syncNextSupplierStock());
 }catch(e){return fail(e)}}
