import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const backend=readFileSync('app/api/suppliers/[action]/route.js','utf8');
const frontend=readFileSync('app/fornecedor/page.jsx','utf8');
const catalog=readFileSync('app/api/catalog/route.js','utf8');

test('atualização de estoque do fornecedor converte quantidade para INTEGER no PostgreSQL',()=>{
 assert.match(backend,/stock=CASE WHEN \$1::text='availability' THEN NULL ELSE \$2::integer END/);
 assert.match(backend,/supplier_available=\$3::boolean/);
 assert.match(backend,/p\.supplier_id=\$4 AND v\.id=\$5/);
 assert.match(backend,/action==='inventory'/);
});

test('estoque 0 não aparece no catálogo; depois de atualizar para 1 aparece',()=>{
 assert.match(catalog,/v\.stock_mode='availability' OR \(v\.stock_mode='quantity' AND v\.stock>0\)/);
 assert.match(frontend,/post\('inventory',\{variant_id:v\.variant_id/);
 assert.match(frontend,/available:f\.get\('available'\)==='on'/);
});
