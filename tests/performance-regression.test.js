import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validImageSignature} from '../lib/image-signature.mjs';
const read=p=>readFileSync(p,'utf8');
test('cotação consulta todos os SKUs em lote e agrega quantidade por variante',()=>{
 const s=read('lib/commerce.js');assert.match(s,/v\.sku=ANY\(\$1::text\[\]\)/);assert.match(s,/quantities\.get\(p\.id\)/);assert.doesNotMatch(s,/WHERE v\.sku=\$1 LIMIT 1/);
});
test('busca exige uma mesma variação correspondente a todos os filtros',()=>{
 const s=read('public/vellor-approved.js');const fn=s.slice(s.indexOf('function variantMatchesFilters('),s.indexOf('function modelsSorted('));
 const match=new Function('available','normalize','sizesFor',fn+';return variantMatchesFilters')(()=>true,x=>x.toLowerCase(),x=>x.sizes);
 const black={variant:'Preto',sizes:['P'],price_brl:80},white={variant:'Branco',sizes:['G'],price_brl:100};
 assert.equal([black,white].some(v=>match(v,'preto','G',120)),false);
 assert.equal(match(black,'preto','P',80),true);assert.equal(match(white,'branco','G',80),false);
});
test('catálogo indexa SKU e grupo e vincula card à variante filtrada',()=>{
 const s=read('public/vellor-approved.js');assert.ok(s.includes('productsBySku.get(sku)')&&s.includes('productsBySlug.get(p.slug)')&&s.includes('indexCatalog(PRODUCTS)')&&s.includes('trigger.dataset.productSku'));
 assert.doesNotMatch(s,/PRODUCTS\.filter\(/);
 assert.ok(s.includes('setTimeout(render,250)'));
});
test('validação binária compartilhada preserva formatos aceitos',()=>{
 const jpeg=Uint8Array.from([255,216,255]),png=Uint8Array.from([137,80,78,71,13,10,26,10]),webp=new TextEncoder().encode('RIFF0000WEBP');
 assert.equal(validImageSignature('image/jpeg',jpeg),true);assert.equal(validImageSignature('image/png',png),true);assert.equal(validImageSignature('image/webp',webp),true);assert.equal(validImageSignature('image/png',jpeg),false);assert.equal(validImageSignature('image/svg+xml',png),false);
 for(const p of ['app/api/admin/upload/route.js','app/api/suppliers/upload/route.js'])assert.match(read(p),/await validateImage\(/);
});
test('telemetria não bloqueia cotação e descrição é escapada',()=>{
 const s=read('app/api/checkout/[action]/route.js');assert.match(s,/after\(async/);assert.match(s,/const quoted=await quoteCart\(x.items,x.coupon\)/);
 assert.match(read('app/api/catalog/route.js'),/p\.description/);assert.match(read('public/vellor-approved.js'),/htmlEsc\(p.description\)/);
});

