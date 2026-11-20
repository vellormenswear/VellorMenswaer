import pg from 'pg';import fs from 'node:fs/promises';import path from 'node:path';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true},max:1});
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL obrigatório');
const c=await pool.connect();try{
 await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(8033331)');
 await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text primary key, applied_at timestamptz default now())');
 const names=(await fs.readdir('db')).filter(x=>/^\d+_.*\.sql$/.test(x)).sort();
 for(const f of names){const done=await c.query('SELECT 1 FROM schema_migrations WHERE version=$1',[f]);if(done.rowCount)continue;
 await c.query(await fs.readFile(path.join('db',f),'utf8'));await c.query('INSERT INTO schema_migrations(version) VALUES($1)',[f]);console.log('Migração aplicada:',f)}
 await c.query('COMMIT');
}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await pool.end()}
