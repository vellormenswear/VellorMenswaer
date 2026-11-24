// One-time maintenance requested by the owner; never runs on normal deployments.
// Preview rolls back all SQL; production requires the exact audited fingerprint.
import pg from 'pg';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {list,del} from '@vercel/blob';
import {normalizePgConnectionString} from '../lib/postgres-ssl.mjs';
const expected='1d3d49562233de9bcd252d46237d9c472734c847a3448c6bcc43445bcd0e7f0b';
const marker='maintenance:2026-11-24-test-cleanup';
const check=process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_GIT_COMMIT_REF==='vellor-launch-cleanup-20261124';
const apply=process.env.VERCEL_ENV==='production'&&process.env.VELLOR_LAUNCH_CLEANUP_FINGERPRINT===expected;
if(!check&&!apply)process.exit(0);
if(!process.env.DATABASE_URL||!process.env.BLOB_READ_WRITE_TOKEN)throw Error('Missing database or Blob configuration');
const pool=new pg.Pool({connectionString:normalizePgConnectionString(process.env.DATABASE_URL),ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000});
const c=await pool.connect();let assetUrls=[],stats={},committed=false;
const n=async(q,args=[])=>Number((await c.query(q,args)).rows[0].n);
const attemptDelete=async(table,id)=>{
 if(!['products','suppliers','users'].includes(table))throw Error('invalid table');
 await c.query('SAVEPOINT cleanup_row');
 try{const result=await c.query('DELETE FROM '+table+' WHERE id=$1',[id]);await c.query('RELEASE SAVEPOINT cleanup_row');return result.rowCount===1;}
 catch(e){await c.query('ROLLBACK TO SAVEPOINT cleanup_row');await c.query('RELEASE SAVEPOINT cleanup_row');if(e.code!=='23503')throw e;return false;}
};
try{
 await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='20s'");
 await c.query('SELECT pg_advisory_xact_lock(8033338)');
 if((await c.query('SELECT 1 FROM schema_migrations WHERE version=$1',[marker])).rowCount){await c.query('ROLLBACK');console.log('[launch-cleanup] already applied; no data changed');process.exitCode=0;}
 else{
  await c.query(await fs.readFile(new URL('../db/014_launch_archive.sql',import.meta.url),'utf8'));
  await c.query('LOCK TABLE users,products,product_variants,product_images,suppliers,supplier_order_groups,infinitepay_checkout_batches,orders,payments IN SHARE ROW EXCLUSIVE MODE');
  const ids=await c.query("SELECT 'p:'||id::text AS key FROM products UNION ALL SELECT 'u:'||id::text FROM users WHERE role NOT IN ('admin','super_admin') ORDER BY key");
  if(createHash('sha256').update(ids.rows.map(r=>r.key).join('\n')).digest('hex')!==expected)throw Error('Target changed since read-only audit; no cleanup applied');
  const adminIds=(await c.query("SELECT id FROM users WHERE role IN ('admin','super_admin') ORDER BY id")).rows.map(r=>r.id);
  if(adminIds.length!==2||await n("SELECT count(*) AS n FROM users WHERE role IN ('admin','super_admin') AND suspended_at IS NULL")!==2||await n("SELECT count(*) AS n FROM users WHERE role='super_admin' AND suspended_at IS NULL")!==1)throw Error('Unexpected administrator count');
  if(await n("SELECT count(*) AS n FROM supplier_order_groups WHERE payment_status='pending' AND checkout_expires_at>now()"))throw Error('Checkout still valid; preserve pending payment');
  const before=await c.query("SELECT (SELECT count(*) FROM orders) AS orders,(SELECT count(*) FROM payments) AS payments,(SELECT COALESCE(sum(amount_cents),0) FROM payments) AS amount,(SELECT count(*) FROM supplier_order_groups) AS groups");
  const protectedUrls=new Set((await c.query("SELECT image_url FROM categories WHERE image_url IS NOT NULL")).rows.map(r=>r.image_url));
  const blob=await list({limit:1000});if(blob.hasMore)throw Error('Unexpected Blob inventory');
  const cutoff=new Date(1795506579009);
  assetUrls=blob.blobs.filter(b=>/^(pg-goston\/products\/|vellor\/suppliers\/)/.test(b.pathname)&&new Date(b.uploadedAt)<=cutoff&&!protectedUrls.has(b.url)).map(b=>b.url);
  if(assetUrls.length>1)throw Error('Blob inventory changed since audit');
  const products=(await c.query('SELECT id FROM products ORDER BY id')).rows;
  const users=(await c.query("SELECT id FROM users WHERE role NOT IN ('admin','super_admin') ORDER BY id")).rows;
  const userIds=users.map(u=>u.id);
  const suppliers=(await c.query('SELECT id FROM suppliers WHERE user_id=ANY($1::uuid[]) ORDER BY id',[userIds])).rows;
  const supplierIds=suppliers.map(s=>s.id);
  stats={images_deleted:(await c.query('DELETE FROM product_images')).rowCount,products_deleted:0,products_archived:0,users_deleted:0,users_archived:0,suppliers_deleted:0,suppliers_archived:0,blob_candidates:assetUrls.length};
  // Submissions and price requests concern only the test catalog. Financial orders and payment records remain intact.
  await c.query('DELETE FROM supplier_price_requests WHERE variant_id IN (SELECT id FROM product_variants)');
  await c.query('DELETE FROM supplier_submissions WHERE supplier_id=ANY($1::uuid[]) OR product_id IN (SELECT id FROM products)',[supplierIds]);
  for(const p of products){
   const used=await n("SELECT count(*) AS n FROM product_variants v WHERE v.product_id=$1 AND (EXISTS(SELECT 1 FROM order_items i WHERE i.variant_id=v.id) OR EXISTS(SELECT 1 FROM supplier_order_items i WHERE i.variant_id=v.id) OR EXISTS(SELECT 1 FROM supplier_stock_reservations r WHERE r.variant_id=v.id) OR EXISTS(SELECT 1 FROM supplier_order_groups g CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.items_snapshot)='array' THEN g.items_snapshot ELSE '[]'::jsonb END) i WHERE i->>'variant_id'=v.id::text))",[p.id]);
   if(!used&&await attemptDelete('products',p.id)){stats.products_deleted++;continue;}
   await c.query("UPDATE products SET active=false,hidden=true,launch_archived_at=now(),slug='arquivo-teste-'||id::text,updated_at=now() WHERE id=$1",[p.id]);
   await c.query("UPDATE product_variants SET active=false,supplier_available=false,primary_image_url=NULL,source_filename=NULL,metadata='{}'::jsonb,sku='ARQUIVO-TESTE-'||id::text,updated_at=now() WHERE product_id=$1",[p.id]);stats.products_archived++;
  }
  await c.query('DELETE FROM supplier_oauth_states WHERE supplier_id=ANY($1::uuid[])',[supplierIds]);
  await c.query('DELETE FROM supplier_mp_connections WHERE supplier_id=ANY($1::uuid[])',[supplierIds]);
  // Remove obsolete wallet credentials, not checkout or webhook history.
  await c.query('DELETE FROM supplier_asaas_wallets WHERE supplier_id=ANY($1::uuid[])',[supplierIds]);
  for(const s of suppliers){
   if(await attemptDelete('suppliers',s.id)){stats.suppliers_deleted++;continue;}
   await c.query("UPDATE suppliers SET status='suspended',launch_archived_at=now(),updated_at=now() WHERE id=$1",[s.id]);stats.suppliers_archived++;
  }
  await c.query('UPDATE supplier_invites SET revoked_at=now() WHERE used_at IS NULL AND revoked_at IS NULL');
  // Preserve request conversations and audit links, but revoke all old test credentials.
  await c.query("UPDATE support_threads SET status='closed',visitor_token_hash=encode(gen_random_bytes(32),'hex'),updated_at=now() WHERE customer_id=ANY($1::uuid[])",[userIds]);
  for(const table of ['sessions','password_reset_tokens','addresses','staff_permissions'])await c.query('DELETE FROM '+table+' WHERE user_id=ANY($1::uuid[])',[userIds]);
  for(const u of users){
   if(await attemptDelete('users',u.id)){stats.users_deleted++;continue;}
   await c.query("UPDATE users SET full_name='Conta de teste arquivada',email='arquivo+'||id::text||'@example.invalid',password_hash='disabled',phone=NULL,suspended_at=now(),launch_archived_at=now(),updated_at=now() WHERE id=$1 AND role NOT IN ('admin','super_admin')",[u.id]);stats.users_archived++;
  }
  const after=await c.query("SELECT (SELECT count(*) FROM orders) AS orders,(SELECT count(*) FROM payments) AS payments,(SELECT COALESCE(sum(amount_cents),0) FROM payments) AS amount,(SELECT count(*) FROM supplier_order_groups) AS groups");
  if(JSON.stringify(before.rows[0])!==JSON.stringify(after.rows[0]))throw Error('Financial integrity check failed');
  const finalAdmins=(await c.query("SELECT id FROM users WHERE role IN ('admin','super_admin') ORDER BY id")).rows.map(r=>r.id);
  if(JSON.stringify(adminIds)!==JSON.stringify(finalAdmins)||await n("SELECT count(*) AS n FROM users WHERE role NOT IN ('admin','super_admin') AND (suspended_at IS NULL OR launch_archived_at IS NULL)")!==0||await n('SELECT count(*) AS n FROM products WHERE launch_archived_at IS NULL')!==0||await n('SELECT count(*) AS n FROM product_images')!==0)throw Error('Cleanup invariant failed');
  await c.query("INSERT INTO audit_logs(action,resource_type,after_data) VALUES('maintenance.test_cleanup','launch',$1)",[JSON.stringify(stats)]);
  await c.query('INSERT INTO schema_migrations(version) VALUES($1)',[marker]);
  if(check){await c.query('ROLLBACK');console.log('[launch-cleanup] DRY RUN rollback '+JSON.stringify(stats));}
  else{await c.query('COMMIT');committed=true;console.log('[launch-cleanup] database committed '+JSON.stringify(stats));}
 }
}catch(e){try{await c.query('ROLLBACK')}catch{};console.error('[launch-cleanup] aborted',e.code||e.message);process.exitCode=1;}
finally{c.release();await pool.end()}
if(committed){
 try{if(assetUrls.length)await del(assetUrls);console.log('[launch-cleanup] blob deleted '+assetUrls.length)}
 catch(e){console.error('[launch-cleanup] database committed; Blob cleanup requires verification',e.name);process.exitCode=1}
}
