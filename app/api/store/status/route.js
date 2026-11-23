import {NextResponse} from 'next/server';
import {getUser} from '@/lib/auth';
import {asaasReady} from '@/lib/asaas.mjs';
export const dynamic='force-dynamic';
export async function GET(req){
 const u=await getUser(req);
 return NextResponse.json({orders_open:asaasReady(process.env,u),mode:'asaas_sandbox'},{headers:{'Cache-Control':'no-store'}});
}
