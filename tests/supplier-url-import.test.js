import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('manual registration only on both editors, old import cannot run',()=>{
 for(const p of ['components/ProductEditor.jsx','components/SupplierListings.jsx']){const s=read(p);assert.doesNotMatch(s,/ProductUrlImport|applyImport|source_url/);assert.match(s,/<VariantGrid/);assert.match(s,/<GroupedVariants/);}
 assert.match(read('components/GroupedVariants.jsx'),/Disponível/);assert.match(read('components/GroupedVariants.jsx'),/Indisponível/);
 assert.match(read('app/api/product-import/route.js'),/410/);assert.doesNotMatch(read('app/api/product-import/route.js'),/readSupplierProduct|fetch\(/);
 for(const p of ['lib/admin-catalog-service.js','lib/supplier-listings.js'])assert.doesNotMatch(read(p),/setProductSource|copyProductSource/);
});
test('storefront only uses local availability, old sync endpoint cannot mutate or fetch suppliers',()=>{
 assert.doesNotMatch(read('public/vellor-approved.js'),/supplier-stock-sync|stockPending|refreshSelectedStock/);
 assert.doesNotMatch(read('app/api/catalog/route.js'),/stock_sync_enabled|source_url/);
 const s=read('app/api/supplier-stock-sync/route.js');assert.doesNotMatch(s,/syncSelectedSupplierStock|fetch\(|UPDATE|INSERT/);assert.match(s,/return catalog\(new Request/);
 assert.match(read('public/vellor-approved.js'),/function listingColors/);assert.match(read('public/vellor-approved.js'),/function listingSizes/);
});
