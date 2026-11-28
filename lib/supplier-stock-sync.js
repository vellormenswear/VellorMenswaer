import {sql,transaction} from '@/lib/db';
import {fetchSupplierPage} from './supplier-public-fetch.mjs';
import {readSupplierProduct} from './read-supplier-product.mjs';
import {logImportFailure} from './supplier-import-errors.mjs';
import {stockUpdates} from './supplier-stock-plan.mjs';
// Atomic lease: concurrent openings of the same product share the most recent check.
// No purchase rules depend on the lease or success of the external request.
export async function syncSelectedSupplierStock(slug,{fetchPage=fetchSupplierPage}={}){
 const candidate=(await sql("UPDATE supplier_product_sources src SET last_checked_at=clock_timestamp() FROM products p JOIN suppliers s ON s.id=p.supplier_id WHERE src.product_id=p.id AND p.slug=$1 AND p.shipping='nacional' AND p.active AND NOT p.hidden AND p.launch_archived_at IS NULL AND COALESCE(p.supplier_listing_status,'approved')='approved' AND s.status='active' AND s.launch_archived_at IS NULL AND (src.last_checked_at IS NULL OR src.last_checked_at<clock_timestamp()-interval '15 seconds') RETURNING src.id,src.product_id,src.source_url,src.last_checked_at::text AS started",[slug])).rows[0];
 if(!candidate)return {checked:0,updated:0};
 let remote=null;try{const {product:data}=await readSupplierProduct(candidate.source_url,{fetchPage});if(!data.variants_incomplete)remote=data.variants}catch(e){logImportFailure('stock',e)}
 if(!remote)return {checked:1,updated:0,failed:true};
 return transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock_shared(8033340)');
  const product=(await c.query("SELECT p.id FROM products p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=$1 AND p.slug=$2 AND p.active AND NOT p.hidden AND p.launch_archived_at IS NULL AND COALESCE(p.supplier_listing_status,'approved')='approved' AND s.status='active' AND s.launch_archived_at IS NULL FOR UPDATE OF p",[candidate.product_id,slug])).rows[0];
  if(!product)return {checked:0,updated:0};
  const source=(await c.query('SELECT id FROM supplier_product_sources WHERE id=$1 AND product_id=$2 AND source_url=$3 AND last_checked_at=$4::timestamptz FOR UPDATE',[candidate.id,candidate.product_id,candidate.source_url,candidate.started])).rows[0];
  if(!source)return {checked:0,updated:0};
  let updated=0;
  const local=(await c.query('SELECT id,label,sizes,active,reported_stock,supplier_available,stock_mode FROM product_variants WHERE product_id=$1 AND supplier_retired_at IS NULL FOR UPDATE',[candidate.product_id])).rows;
  for(const row of stockUpdates(local,remote)){
   const r=await c.query("UPDATE product_variants SET reported_stock=COALESCE($1::integer,reported_stock),supplier_available=COALESCE($2::boolean,supplier_available),updated_at=now() WHERE id=$3 AND product_id=$4 AND active AND supplier_retired_at IS NULL AND stock_mode='availability' AND updated_at<=$5::timestamptz",[row.reported_stock,row.supplier_available,row.id,candidate.product_id,candidate.started]);updated+=r.rowCount;
  }
  return {checked:1,updated,failed:false};
 });
}
