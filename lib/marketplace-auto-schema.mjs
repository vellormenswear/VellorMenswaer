import {MARKETPLACE_MIGRATIONS} from './marketplace-schema-sql.mjs';

// Runs on the first authenticated ADMIN panel visit, not at build time.
// A database-level advisory transaction lock prevents duplicate concurrent deployments.
// A complete rollback is done if any step fails. Existing rows are never deleted.
const REQUIRED_BASE=['users','products','product_variants','orders','schema_migrations'];

export class MarketplaceSchemaError extends Error {}

export async function applyMarketplaceMigrations(connect){
  const client=await connect();
  let started=false;
  try {
    await client.query('BEGIN');started=true;
    await client.query(`SET LOCAL lock_timeout = '8s'`);
    await client.query(`SET LOCAL statement_timeout = '25000ms'`);
    await client.query('SELECT pg_advisory_xact_lock($1)',[8033331]);
    const base=await client.query('SELECT to_regclass($1) AS users, to_regclass($2) AS products, to_regclass($3) AS variants, to_regclass($4) AS orders, to_regclass($5) AS versions',REQUIRED_BASE.map(n=>'public.'+n));
    const missing=['users','products','variants','orders','versions'].filter(n=>!base.rows[0]?.[n]);
    if(missing.length)throw new MarketplaceSchemaError('O banco está conectado, mas a estrutura principal ainda não foi inicializada ('+missing.join(', ')+'). A atualização automática foi interrompida por segurança.');
    const applied=[];
    const existing=await client.query('SELECT version FROM schema_migrations WHERE version=ANY($1::text[])',[MARKETPLACE_MIGRATIONS.map(([name])=>name)]);
    const known=new Set(existing.rows.map(row=>row.version));
    for(const [name,script] of MARKETPLACE_MIGRATIONS){
      if(known.has(name))continue;
      await client.query(script);
      await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[name]);
      applied.push(name);
    }
    await client.query('COMMIT');started=false;
    return {applied};
  }catch(e){
    if(started){try{await client.query('ROLLBACK')}catch{}}
    throw e;
  }finally{client.release()}
}
