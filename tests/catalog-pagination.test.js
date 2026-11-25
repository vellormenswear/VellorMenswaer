import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCatalogPage,CATALOG_WHERE} from '../lib/catalog-query.mjs';
test('cursor conserva microssegundos e restringe tamanho de página',()=>{
 const time='2026-11-25T01:02:03.123456Z',id='00000000-0000-4000-8000-000000000001';
 assert.deepEqual(parseCatalogPage(new URLSearchParams()),{limit:48,time:null,id:null});
 assert.deepEqual(parseCatalogPage(new URLSearchParams({limit:'60',cursor:time+'|'+id})),{limit:60,time,id});
 for(const p of [{limit:'61'},{limit:'0'},{cursor:'bad'},{cursor:time+'|not-a-uuid'}])assert.throws(()=>parseCatalogPage(new URLSearchParams(p)));
});
test('paginação conserva variações do mesmo modelo e critérios comerciais compartilhados',()=>{
 const s=readFileSync('app/api/catalog/route.js','utf8');assert.match(s,/SELECT DISTINCT p.id/);assert.match(s,/JOIN selected_models page ON page.id=p.id/);assert.match(s,/CATALOG_WHERE/);assert.match(CATALOG_WHERE,/launch_archived_at IS NULL/);
 const js=readFileSync('public/vellor-approved.js','utf8');assert.match(js,/fetchCatalogPages/);assert.match(js,/while\(cursor\)/);assert.match(js,/seen.has\(cursor\)/);
});
test('modal usa diálogo nativo e restaura foco',()=>{
 const html=readFileSync('public/vitrine.html','utf8'),js=readFileSync('public/vellor-approved.js','utf8');assert.match(html,/<dialog[^>]+id="product-modal"/);assert.match(js,/modal.showModal\(\)/);assert.match(js,/previousProductFocus.focus\(\)/);
});
test('produto e variação possuem auditoria na mesma transação',()=>{
 const service=readFileSync('lib/admin-catalog-service.js','utf8');assert.match(service,/saveAdminProduct/);assert.match(service,/saveAdminVariant/);assert.match(service,/auditTx\(c,u.id,'product.upsert'/);assert.match(service,/auditTx\(c,u.id,'variant.upsert'/);
});
