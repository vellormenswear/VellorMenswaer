import pg from 'pg';
import {normalizePgConnectionString} from '../lib/postgres-ssl.mjs';
import {CATALOG_FROM,CATALOG_WHERE} from '../lib/catalog-query.mjs';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='vellor-readonly-diagnosis-20261125')throw Error('Diagnostic branch only');
const pool=new pg.Pool({connectionString:normalizePgConnectionString(process.env.DATABASE_URL),ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:8000});
let c;try{
 c=await pool.connect();await c.query('BEGIN READ ONLY');await c.query("SET LOCAL statement_timeout='10000ms'");
 const stats=(await c.query(`SELECT
 (SELECT count(*)::int FROM products) AS products_total,
 (SELECT count(*)::int FROM products WHERE launch_archived_at IS NOT NULL) AS archived_products,
 (SELECT count(*)::int FROM products WHERE launch_archived_at IS NULL) AS current_products,
 (SELECT count(*)::int FROM products WHERE launch_archived_at IS NULL AND NOT active) AS inactive_products,
 (SELECT count(*)::int FROM products WHERE launch_archived_at IS NULL AND hidden) AS hidden_products,
 (SELECT count(*)::int FROM products WHERE launch_archived_at IS NULL AND shipping<>'nacional') AS non_national,
 (SELECT count(*)::int FROM products p WHERE p.launch_archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id)) AS no_variants,
 (SELECT count(*)::int FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN users su ON su.id=s.user_id WHERE p.launch_archived_at IS NULL AND (s.id IS NULL OR s.status<>'active' OR s.launch_archived_at IS NOT NULL OR su.id IS NULL OR su.suspended_at IS NOT NULL OR su.launch_archived_at IS NOT NULL)) AS unavailable_supplier,
 (SELECT count(*)::int FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.launch_archived_at IS NULL) AS current_variants,
 (SELECT count(*)::int FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.launch_archived_at IS NULL AND (NOT v.active OR NOT v.supplier_available)) AS inactive_variants,
 (SELECT count(*)::int FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.launch_archived_at IS NULL AND (v.price_cents IS NULL OR v.price_cents<=0 OR v.supplier_cost_cents IS NULL OR v.supplier_cost_cents<=0 OR v.price_cents<=v.supplier_cost_cents)) AS invalid_price_cost,
 (SELECT count(*)::int FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.launch_archived_at IS NULL AND v.stock_mode='quantity' AND (v.stock IS NULL OR v.stock<=0)) AS invalid_stock,
 (SELECT count(*)::int FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.launch_archived_at IS NULL AND NULLIF(v.primary_image_url,'') IS NULL AND NOT EXISTS(SELECT 1 FROM product_images i WHERE i.product_id=p.id AND i.variant_id IS NULL AND NULLIF(i.url,'') IS NOT NULL)) AS missing_image,
 (SELECT count(*)::int ${CATALOG_FROM} WHERE ${CATALOG_WHERE}) AS eligible_variants,
 EXISTS(SELECT 1 FROM schema_migrations WHERE version='016_checkout_attempts.sql') AS migration_016_recorded,
 to_regclass('public.checkout_attempts') IS NOT NULL AS attempts_table,
 EXISTS(SELECT 1 FROM schema_migrations WHERE version='maintenance:2026-11-24-test-cleanup') AS historical_cleanup_recorded
 `)).rows[0];
 console.log('[vellor-qa-readonly] '+JSON.stringify(stats));
 await c.query('ROLLBACK');
}catch(e){if(c)try{await c.query('ROLLBACK')}catch{};console.error('[vellor-qa-readonly] failed '+(e.code||e.name));process.exitCode=1}
finally{c?.release();await pool.end()}
