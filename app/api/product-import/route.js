import {ok} from '@/lib/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Retired endpoint: no external request or database write, including stale clients.
export async function POST(){return ok({error:'O cadastro de produtos é manual.'},410)}
