import {secureCompare} from '@/lib/security';
import {refreshDueShipments} from '@/lib/shipment-tracking';
import {ok,fail,HttpError} from '@/lib/http';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
export async function GET(req){try{const secret=process.env.CRON_SECRET;if(!secret||!secureCompare(req.headers.get('authorization')||'','Bearer '+secret))throw new HttpError(401,'Não autorizado.');if(!process.env.PACOTEVICIO_API_KEY)throw new HttpError(503,'Rastreamento indisponível.');return ok(await refreshDueShipments());}catch(e){return fail(e);}}
