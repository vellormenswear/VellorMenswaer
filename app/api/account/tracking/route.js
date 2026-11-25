import {requireUser} from '@/lib/auth';
import {body,ensure,fail,ok,originGuard,uuid} from '@/lib/http';
import {listTracking,refreshTracking} from '@/lib/shipment-tracking';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
export async function GET(req){try{const u=await requireUser(req);const id=new URL(req.url).searchParams.get('orderId');ensure(uuid(id),'Pedido inválido.');return ok({shipments:await listTracking(u.id,id)});}catch(e){return fail(e);}}
export async function POST(req){try{originGuard(req);const u=await requireUser(req);const x=await body(req,2048);ensure(uuid(x.orderId)&&uuid(x.groupId),'Remessa inválida.');return ok({shipment:await refreshTracking(u.id,x.orderId,x.groupId)});}catch(e){return fail(e);}}
