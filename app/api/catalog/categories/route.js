import {sql} from '@/lib/db';import {ok,fail} from '@/lib/http';
export const dynamic='force-dynamic';
export async function GET(){try{return ok({categories:(await sql('SELECT c.id,c.name,c.slug,c.sort_order,to_jsonb(c)->>'parent_id' AS parent_id,to_jsonb(c)->>'image_url' AS image_url,p.slug AS parent_slug FROM categories c LEFT JOIN categories p ON p.id=(to_jsonb(c)->>'parent_id')::uuid WHERE c.active AND (p.id IS NULL OR p.active) ORDER BY c.sort_order,c.name')).rows})}catch(e){return fail(e)}}
