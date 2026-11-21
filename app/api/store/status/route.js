import {NextResponse} from 'next/server';
import {getUser} from '@/lib/auth';
import {checkoutAllowedForUser} from '@/lib/supplier-checkout.mjs';
export const dynamic='force-dynamic';
export async function GET(req){
 const u=await getUser(req);
 return NextResponse.json({orders_open:checkoutAllowedForUser(process.env,u),mode:process.env.MP_MODE||'disabled'},{headers:{'Cache-Control':'no-store'}});
}
