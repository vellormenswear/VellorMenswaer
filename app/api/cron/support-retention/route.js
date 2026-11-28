import {secureCompare} from '@/lib/security';
import {transaction} from '@/lib/db';
import {purgeSupportHistory} from '@/lib/support-retention.mjs';
import {ok,fail,HttpError} from '@/lib/http';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
export async function GET(req){try{const secret=process.env.CRON_SECRET;if(!secret||!secureCompare(req.headers.get('authorization')||'','Bearer '+secret))throw new HttpError(401,'Não autorizado.');return ok(await transaction(purgeSupportHistory));}catch(e){return fail(e);}}
