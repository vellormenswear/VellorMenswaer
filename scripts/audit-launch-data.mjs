import pg from 'pg';
import {createHash} from 'node:crypto';
import {normalizePgConnectionString} from '../lib/postgres-ssl.mjs';
import {list} from '@vercel/blob';
const flag=process.argv.includes('--manual');
if(!flag&&process.env.VERCEL_GIT_COMMIT_REF!=='vellor-launch-cleanup-20261124')process.exit(0);
if(!process.env.DATABASE_URL){console.log('[launch-audit] no database');process.exit(0)}
const pool=new pg.Pool({connectionString:normalizePgConnectionString(process.env.DATABASE_URL),ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:8000});
const c=await pool.connect();
try{
 await c.query('BEGIN READ ONLY');await c.query("SET LOCAL statement_timeout='10s'");
 const tableList=(await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")).rows.map(r=>r.table_name);
 if(!['users','products','product_variants','supplier_order_groups','infinitepay_checkout_batches','customer_request_messages'].every(t=>tableList.includes(t)))throw Error('unexpected schema');
 const counts=await c.query("SELECT (SELECT count(*)::int FROM products) products,(SELECT count(*)::int FROM product_variants) variants,(SELECT count(*)::int FROM product_images) images,(SELECT count(*)::int FROM suppliers) suppliers,(SELECT count(*)::int FROM users WHERE role NOT IN ('admin','super_admin')) non_admins,(SELECT count(*)::int FROM users WHERE role IN ('admin','super_admin') AND suspended_at IS NULL) active_admins,(SELECT count(*)::int FROM orders) orders,(SELECT count(*)::int FROM payments) payments,(SELECT count(*)::int FROM supplier_order_groups WHERE payment_status='pending' AND checkout_expires_at>now()) pending_unexpired,(SELECT count(*)::int FROM infinitepay_checkout_batches WHERE status IN ('creating','pending')) unsettled_batches");
 const roles=await c.query("SELECT role,count(*)::int AS total FROM users GROUP BY role ORDER BY role");
 const payments=await c.query("SELECT provider,status,count(*)::int AS total FROM payments GROUP BY provider,status ORDER BY provider,status");
 const ids=await c.query("SELECT 'p:'||id::text AS key FROM products UNION ALL SELECT 'u:'||id::text FROM users WHERE role NOT IN ('admin','super_admin') ORDER BY key");
 const fingerprint=createHash('sha256').update(ids.rows.map(r=>r.key).join('\n')).digest('hex');
 const refs=await c.query("SELECT conrelid::regclass::text AS source,confrelid::regclass::text AS target,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype='f' AND confrelid IN ('users'::regclass,'products'::regclass,'product_variants'::regclass,'suppliers'::regclass) ORDER BY source,target");
 console.log('[launch-audit] '+JSON.stringify({counts:counts.rows[0],roles:roles.rows,payments:payments.rows,fingerprint,refs:refs.rows,environment:process.env.VERCEL_ENV}));
 await c.query('COMMIT');
}catch(e){await c.query('ROLLBACK');console.error('[launch-audit] failed',e.code||e.name);process.exitCode=1}
finally{c.release();await pool.end()}
if(process.env.BLOB_READ_WRITE_TOKEN){try{let cursor,counts={products:0,suppliers:0,other:0};do{const r=await list({cursor,limit:1000});for(const b of r.blobs){const p=b.pathname;counts[p.startsWith('pg-goston/products/')?'products':p.startsWith('vellor/suppliers/')?'suppliers':'other']++}cursor=r.hasMore?r.cursor:undefined}while(cursor);console.log('[launch-audit] blob '+JSON.stringify(counts))}catch(e){console.error('[launch-audit] blob unavailable',e.name)}}
