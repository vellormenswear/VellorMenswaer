// Production-only, additive migration for the VELLOR support inbox.
// Category migration only updates the category references of explicitly mapped products. Orders and payments remain untouched.
import pg from 'pg';
import fs from 'node:fs/promises';
import {normalizePgConnectionString} from '../lib/postgres-ssl.mjs';
if(process.env.VERCEL_ENV!=='production'){
 console.log('[vellor.support] support migration skipped outside production');
 process.exit(0);
}
if(!process.env.DATABASE_URL)throw new Error('[vellor.support] DATABASE_URL is required for production support migration');
const files=['007_support_chat.sql','011_category_hierarchy.sql','012_request_conversations.sql','013_infinitepay_default.sql','014_launch_archive.sql','015_product_codes.sql','016_checkout_attempts.sql','017_shipment_tracking.sql','018_product_departments.sql','019_campaigns.sql','020_manual_campaigns.sql','021_supplier_listings.sql','022_supplier_pix_city.sql','023_address_recipient.sql','024_reported_variant_stock.sql','025_supplier_product_sources.sql','026_support_retention.sql'];
const connectionString=normalizePgConnectionString(process.env.DATABASE_URL);
const pool=new pg.Pool({connectionString,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000});
let client;
try{
 client=await pool.connect();
 await client.query('BEGIN');
 await client.query("SET LOCAL lock_timeout='8s'");
 await client.query("SET LOCAL statement_timeout='25000ms'");
 await client.query('SELECT pg_advisory_xact_lock(8033331)');
 const base=await client.query("SELECT to_regclass('public.users')::text AS users,to_regclass('public.schema_migrations')::text AS migrations");
 if(!base.rows[0]?.users||!base.rows[0]?.migrations)throw new Error('Estrutura principal de usuarios ou migrações ausente: operação interrompida.');
 for(const file of files){
 const sqlText=await fs.readFile(new URL('../db/'+file,import.meta.url),'utf8');
 const applied=await client.query('SELECT 1 FROM schema_migrations WHERE version=$1',[file]);
 if(!applied.rowCount){
  await client.query(sqlText);
  await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[file]);
 }
 }
 await client.query('COMMIT');
 console.log('[vellor.schema] support and category schemas ready');
}catch(e){
 if(client)try{await client.query('ROLLBACK')}catch{}
 console.error('[vellor.support] safe additive migration failed:',e?.message);
 process.exitCode=1;
}finally{
 client?.release();
 await pool.end();
}
