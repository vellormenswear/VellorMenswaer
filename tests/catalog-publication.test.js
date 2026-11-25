import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalogPublication} from '../lib/catalog-publication.mjs';
import {stockAllowsQuantity} from '../lib/stock-availability.mjs';
const p={active:true,hidden:false,shipping:'nacional',supplier_status:'active'};
const v={sku:'TEST',active:true,supplier_available:true,price_cents:1000,supplier_cost_cents:500,stock_mode:'quantity',stock:1,catalog_image_url:'/product-images/sem-foto.svg'};
test('publicação exige todos os requisitos e mostra motivos específicos',()=>{
 assert.equal(catalogPublication(p,[v]).publication_status,'published');
 for(const change of [{stock:null},{stock:0},{supplier_cost_cents:0},{supplier_cost_cents:null},{supplier_available:false},{catalog_image_url:null},{price_cents:500}]){
  const result=catalogPublication(p,[{...v,...change}]);assert.equal(result.publication_status,'pending');assert.ok(result.publication_issues.length);
 }
 assert.equal(catalogPublication(p,[{...v,stock_mode:'availability',stock:null}]).publication_status,'published');
 assert.equal(catalogPublication(p,[{...v,stock:0},v]).publication_status,'published');
 assert.equal(catalogPublication({...p,hidden:true},[v]).publication_status,'hidden');
 assert.equal(catalogPublication({...p,supplier_status:'suspended'},[v]).publication_status,'pending');
 assert.equal(catalogPublication(p,[]).publication_status,'pending');
});
test('disponibilidade não aceita quantidade inválida',()=>{assert.equal(stockAllowsQuantity('availability',null,0),false);assert.equal(stockAllowsQuantity('unknown',4,1),false)});
test('carrinho conserva itens ausentes e bloqueia finalização',()=>{
 const js=readFileSync('public/vellor-approved.js','utf8');assert.doesNotMatch(js,/cart=cart.filter\([^;]*bySku/);assert.match(js,/Produto temporariamente indisponível/);assert.match(js,/disabled=!cart.length\|\|unavailable/);
});
