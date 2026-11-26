import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const shop=read('public/vellor-approved.css'),internal=read('app/globals.css');
test('vitrine mantém quatro colunas desktop e aumenta densidade somente em telas maiores',()=>{
 assert.match(shop,/#grid\.vellor-product-grid\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 for(const [width,columns] of [[1800,5],[2560,6]]){const a=shop.lastIndexOf('@media(min-width:'+width+'px)');const b=shop.indexOf('@media(',a+1);const section=shop.slice(a,b);assert.ok(a>=0);assert.ok(section.includes('repeat('+columns+',minmax(0,1fr))'));}
});
test('painéis largos não expandem a largura de checkout ou páginas de leitura',()=>{
 assert.match(internal,/\.admin\.vll-admin-app\{max-width:2200px/);
 assert.match(internal,/\.page\.vll-supplier-app,\.page\.vll-operations-page\{max-width:2000px/);
 assert.match(internal,/\.checkoutbox\{max-width:850px/);
 assert.ok(read('app/fornecedor/page.jsx').includes('page vll-supplier-app'));
});
test('tabelas e textos longos ficam contidos sem ocultar a rolagem geral',()=>{
 assert.match(internal,/\.tablewrap\{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain\}/);
 assert.match(shop,/\.card-name,\.card-category,\.card-variants,\.detail-info h2,\.sku,\.cart-row-name,\.cart-row-var,\.vellor-mega-links a\{overflow-wrap:anywhere\}/);
 assert.doesNotMatch(internal,/html\s*\{[^}]*overflow-x\s*:\s*hidden/);
});
test('larguras reduzidas e janelas baixas mantêm controles acessíveis',()=>{
 assert.ok(shop.includes('@media(max-height:500px)'));
 assert.ok(shop.includes('.filters-end .sort{width:100%;max-width:none}'));
 assert.ok(internal.includes('.vll-admin-app .sidebar{max-height:none;overflow-y:hidden}'));
 assert.ok(internal.includes('.vll-admin-app .cols3,.vll-admin-app .productgrid,.app-quicklinks{grid-template-columns:minmax(0,1fr)}'));
});

test('destaques verticais mantêm quatro cards no computador e dois no celular',()=>{assert.match(shop,/vellor-product-track\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);assert.match(shop,/vellor-product-track\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(shop,/height:var\(--featured-height,auto\)/);assert.match(shop,/grid-auto-rows:1fr/);});
