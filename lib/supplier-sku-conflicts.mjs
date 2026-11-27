export async function supplierSkuConflicts(c,candidates,submissionId=null){
 if(!candidates.length)return new Set();
 const skus=[...new Set(candidates.map(v=>v.sku))];
 const productRows=(await c.query("SELECT upper(sku) AS sku,id FROM product_variants WHERE upper(sku)=ANY($1::text[])",[skus])).rows;
 const reservedRows=(await c.query("SELECT DISTINCT upper(v->>'sku') AS sku FROM supplier_submissions s CROSS JOIN LATERAL jsonb_array_elements(s.variants) v WHERE s.status IN ('pending','inactive') AND ($2::uuid IS NULL OR s.id<>$2) AND upper(v->>'sku')=ANY($1::text[])",[skus,submissionId])).rows;
 const products=new Map();for(const row of productRows){if(!products.has(row.sku))products.set(row.sku,[]);products.get(row.sku).push(row.id);}
 const reserved=new Set(reservedRows.map(r=>r.sku));return new Set(candidates.filter(v=>reserved.has(v.sku)||(products.get(v.sku)||[]).some(id=>id!==v.oldId)).map(v=>v.field));
}
