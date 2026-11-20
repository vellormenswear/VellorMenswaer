import {sql} from '@/lib/db';import {ok,fail} from '@/lib/http';
export const dynamic='force-dynamic';
export async function GET(){try{return ok({categories:(await sql('SELECT id,name FROM categories WHERE active ORDER BY name')).rows})}catch(e){return fail(e)}}
