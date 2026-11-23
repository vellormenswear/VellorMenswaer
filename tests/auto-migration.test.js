import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MARKETPLACE_MIGRATIONS} from '../lib/marketplace-schema-sql.mjs';
import {applyMarketplaceMigrations, MarketplaceSchemaError} from '../lib/marketplace-auto-schema.mjs';

function fakeDb({known=[],broken='',missingBase=[]}={}) {
 const applied=new Set(known),calls=[];let released=false,committed=false,rolledBack=false;
 const conn={
  async query(query,args=[]) {
   calls.push(query);
   if(query.includes('to_regclass(')){
    return {rows:[{users:missingBase.includes('users')?null:'users',products:missingBase.includes('products')?null:'products',variants:missingBase.includes('variants')?null:'product_variants',orders:missingBase.includes('orders')?null:'orders',versions:missingBase.includes('versions')?null:'schema_migrations'}]};
   }
   if(query.startsWith('SELECT 1 FROM schema_migrations'))return {rowCount:applied.has(args[0])?1:0};
   if(query.startsWith('INSERT INTO schema_migrations')){applied.add(args[0]);return {rowCount:1}}
   if(query==='COMMIT'){committed=true;return {rowCount:0}}
   if(query==='ROLLBACK'){rolledBack=true;return {rowCount:0}}
   if(query===broken)throw Error('migração falhou propositalmente');
   return {rowCount:0};
  },
  release(){released=true}
 };
 return {connect:async()=>conn,calls,applied,get released(){return released},get committed(){return committed},get rolledBack(){return rolledBack}};
}

test('bundle de migrações corresponde aos SQLs versionados',()=>{
 for(const [name,sql] of MARKETPLACE_MIGRATIONS){
  assert.equal(sql,readFileSync('db/'+name,'utf8'));
  assert.match(name,/^0(?:0[234689]|10)_/);
 }
});

test('instala somente migrações pendentes e registra versões',async()=>{
 const f=fakeDb({known:['002_marketplace.sql']});
 const r=await applyMarketplaceMigrations(f.connect);
 assert.deepEqual(r.applied,MARKETPLACE_MIGRATIONS.filter(([name])=>name!=='002_marketplace.sql').map(([name])=>name));
 assert.equal(f.applied.size,MARKETPLACE_MIGRATIONS.length);
 assert.equal(f.committed,true);
 assert.equal(f.released,true);
});

test('reexecução não repete DDL',async()=>{
 const f=fakeDb({known:MARKETPLACE_MIGRATIONS.map(x=>x[0])});
 const r=await applyMarketplaceMigrations(f.connect);
 assert.deepEqual(r.applied,[]);
 assert.equal(f.calls.some(x=>x.startsWith('-- Migração')),false);
 assert.equal(f.committed,true);
});

test('banco errado ou sem estrutura principal aborta sem DDL',async()=>{
 const f=fakeDb({missingBase:['products']});
 await assert.rejects(applyMarketplaceMigrations(f.connect),MarketplaceSchemaError);
 assert.equal(f.rolledBack,true);
 assert.equal(f.committed,false);
 assert.equal(f.released,true);
});

test('falha na migração executa ROLLBACK',async()=>{
 const f=fakeDb({broken:MARKETPLACE_MIGRATIONS[0][1]});
 await assert.rejects(applyMarketplaceMigrations(f.connect),/migração falhou/);
 assert.equal(f.rolledBack,true);
 assert.equal(f.committed,false);
 assert.equal(f.released,true);
});

test('somente painel administrativo dispara a inicialização, sem alterar o checkout',()=>{
 const r=readFileSync('app/api/admin/marketplace-status/route.js','utf8');
 assert.match(r,/export async function POST\(req\)/);
 assert.match(r,/originGuard\(req\)/);
 assert.match(r,/await requireRole\(req,\['admin','super_admin'\]\)/);
 const a=readFileSync('app/admin/fornecedores/page.jsx','utf8');
 const b=readFileSync('app/admin/financeiro/page.jsx','utf8');
 assert.match(a,/call\('POST','admin\/marketplace-status'/);
 assert.match(b,/marketplace-status'\,\{method:'POST'/);
});
