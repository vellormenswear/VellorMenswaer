import {NextResponse} from 'next/server';
import {getUser} from '@/lib/auth';
import {infinitepayReady} from '@/lib/infinitepay.mjs';
export const dynamic='force-dynamic';
export async function GET(req){
 const u=await getUser(req);
 return NextResponse.json({orders_open:infinitepayReady(process.env,u),mode:'infinitepay'},{headers:{'Cache-Control':'no-store'}});
}
