import {sql,transaction} from '@/lib/db';
import {fetchSupplierPage} from './supplier-public-fetch.mjs';
import {parseSupplierProduct} from './supplier-product-import.mjs';
import {stockUpdates} from './supplier-stock-plan.mjs';
// One bounded, oldest-first job per invocation; external scheduler controls cadence.
export async function syncNextSupplierStock(){
 const candidate=(await sql("SELECT src.id,src.product_id,src.source_url,src.last_checked_at::text AS last_checked_at,clock_timestamp()::text AS started FROM supplier_product_sources src JOIN products p ON p.id=src.product_id JOIN suppliers s ON s.id=p.supplier_id WHERE p.active AND NOT p.hidden AND p.launch_archived_at IS NULL AND COALESCE(p.supplier_listing_status,'approved')='approved' AND s.status='active' AND s.launch_archived_at IS NULL ORDER BY src.last_checked_at NULLS FIRST,src.id LIMIT 1")).rows[0];
 if(!candidate)return {checked:0,updated:0};
 let remote=null;try{const page=await fetchSupplierPage(candidate.source_url);const data=parseSupplierProduct(page.html,page.url);if(!data.variants_incomplete)remote=data.variants}catch{}
 return transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock_shared(8033340)');
  const product=(await c.query("SELECT p.id FROM products p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=$1 AND p.active AND NOT p.hidden AND p.launch_archived_at IS NULL AND COALESCE(p.supplier_listing_status,'approved')='approved' AND s.status='active' AND s.launch_archived_at IS NULL FOR UPDATE OF p",[candidate.product_id])).rows[0];
  if(!product)return {checked:0,updated:0};
  const source=(await c.query('SELECT id FROM supplier_product_sources WHERE id=$1 AND product_id=$2 AND source_url=$3 AND last_checked_at IS NOT DISTINCT FROM $4::timestamptz FOR UPDATE',[candidate.id,candidate.product_id,candidate.source_url,candidate.last_checked_at])).rows[0];
  if(!source)return {checked:0,updated:0};
  let updated=0;
  if(remote){
   const local=(await c.query('SELECT id,label,sizes,active,reported_stock,supplier_available,stock_mode FROM product_variants WHERE product_id=$1 AND supplier_retired_at IS NULL FOR UPDATE',[candidate.product_id])).rows;
   for(const row of stockUpdates(local,remote)){
    const r=await c.query("UPDATE product_variants SET reported_stock=COALESCE($1::integer,reported_stock),supplier_available=COALESCE($2::boolean,supplier_available),updated_at=now() WHERE id=$3 AND product_id=$4 AND active AND supplier_retired_at IS NULL AND stock_mode='availability' AND updated_at<=$5::timestamptz",[row.reported_stock,row.supplier_available,row.id,candidate.product_id,candidate.started]);updated+=r.rowCount;
   }
  }
  await c.query('UPDATE supplier_product_sources SET last_checked_at=now() WHERE id=$1',[candidate.id]);
  return {checked:1,updated,failed:remote===null};
 });
}
