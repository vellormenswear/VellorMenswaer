import {sql} from '@/lib/db';import {ok,fail} from '@/lib/http';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function GET(){try{const r=await sql("SELECT id,theme,name,headline,message,decoration,intensity,starts_at,ends_at,updated_at FROM store_campaigns WHERE enabled AND starts_at<=now() AND ends_at>now() ORDER BY decoration DESC,starts_at DESC,id DESC");return ok({campaign:r.rows[0]||null,revision:r.rows.map(c=>c.id+':'+new Date(c.updated_at).toISOString()).join('|')})}catch(e){return fail(e)}}
