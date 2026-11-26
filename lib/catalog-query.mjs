// Shared static SQL fragments; never interpolate request data into these expressions.
export const CATALOG_IMAGE="COALESCE(NULLIF(NULLIF(v.primary_image_url,''),'/product-images/sem-foto.svg'),cover.url,NULLIF(v.primary_image_url,''))";
export const CATALOG_FROM="FROM product_variants v JOIN products p ON p.id=v.product_id JOIN suppliers s ON s.id=p.supplier_id AND s.status='active' LEFT JOIN LATERAL (SELECT url FROM product_images WHERE product_id=p.id AND variant_id IS NULL ORDER BY sort_order,created_at DESC,id LIMIT 1) cover ON true";
export const CATALOG_WHERE="p.shipping='nacional' AND p.active AND NOT p.hidden AND COALESCE(p.supplier_listing_status,'approved')='approved' AND v.supplier_retired_at IS NULL AND p.launch_archived_at IS NULL AND s.launch_archived_at IS NULL AND v.active AND v.supplier_available AND (v.stock_mode='availability' OR (v.stock_mode='quantity' AND v.stock>0)) AND v.price_cents IS NOT NULL AND v.price_cents > 0 AND v.supplier_cost_cents IS NOT NULL AND v.supplier_cost_cents>0 AND v.price_cents>v.supplier_cost_cents AND COALESCE(NULLIF(NULLIF(v.primary_image_url,''),'/product-images/sem-foto.svg'),cover.url,NULLIF(v.primary_image_url,'')) IS NOT NULL";
export const CATALOG_SORT_TIME="COALESCE(p.created_at,'1970-01-01'::timestamptz)";
export const CATALOG_CURSOR_TIME="YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"";
export function parseCatalogPage(params){
 const raw=params.get('limit')||'48';
 if(!/^\d{1,3}$/.test(raw))throw Error('Limite inválido.');
 const limit=Number(raw);
 if(limit<1||limit>60)throw Error('Limite inválido.');
 const cursor=params.get('cursor');
 if(cursor===null)return {limit,time:null,id:null};
 if(cursor.length>80)throw Error('Cursor inválido.');
 const [time,id,...extra]=cursor.split('|');
 if(extra.length||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(time)||!Number.isFinite(Date.parse(time))||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(id||''))throw Error('Cursor inválido.');
 return {limit,time,id};
}
