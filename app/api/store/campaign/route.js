import {sql} from '@/lib/db';import {ok,fail} from '@/lib/http';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(){try{const r=await sql("SELECT id,theme,name,headline,message,decoration,intensity,starts_at,ends_at,updated_at FROM store_campaigns WHERE enabled AND starts_at<=now() AND ends_at>now() ORDER BY decoration DESC,starts_at DESC,id DESC LIMIT 1");return ok({campaign:r.rows[0]||null})}catch(e){return fail(e)}}
