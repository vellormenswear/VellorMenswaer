import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=process.cwd();const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/catalogo-nacional.json'),'utf8'));
test('catálogo público não possui produtos nem fotos de teste embutidos',()=>{
 assert.deepEqual(catalog,[]);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'public/catalogo-vellor-base.json'),'utf8')),[]);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'public/gallery-map.json'),'utf8')),{});
 const html=fs.readFileSync(path.join(root,'public/vitrine.html'),'utf8'),js=fs.readFileSync(path.join(root,'public/vellor-approved.js'),'utf8');
 assert.match(html,/<script id="catalog" type="application\/json">\[\]<\/script>/);
 assert.ok(js.includes('let PRODUCTS=[],catalogLoaded=false')&&js.includes('catalogLoaded=true')&&js.includes('if(!catalogLoaded)'));
 assert.ok(!fs.existsSync(path.join(root,'scripts/seed.mjs')));
 assert.deepEqual(fs.readdirSync(path.join(root,'public/product-images')),['sem-foto.svg']);
});

test('HTML preservado e responsivo, com ponte para checkout',()=>{const html=fs.readFileSync(path.join(root,'public/vitrine.html'),'utf8');const css=fs.readFileSync(path.join(root,'public/vellor-approved.css'),'utf8');assert.ok(css.includes('@media(max-width:620px)'));assert.ok(html.includes('vellor-approved.js'));assert.ok(html.includes('vellor-approved.css'));assert.ok(html.includes('VELLOR WEAR'));assert.ok(!fs.existsSync(path.join(root,'docs/HTML-ORIGINAL-APROVADO.html')))});

test('rodape aprovado inclui FAQ, pagamento sem bandeiras inventadas e contato humano',()=>{
 const html=fs.readFileSync(path.join(root,'public/vitrine.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'public/vellor-approved.css'),'utf8');
 const chatjs=fs.readFileSync(path.join(root,'public/vellor-support.js'),'utf8');
 assert.match(html,/id="vellor-faq-heading"/);
 assert.equal((html.match(/<details>/g)||[]).length,6);
 assert.match(html,/Pix e cartões Visa, Mastercard, Elo e American Express/);
 for(const marca of ['Pix','Visa','Mastercard','Elo','American Express','InfinitePay'])assert.ok(html.includes('alt="'+marca+'"'));
 assert.ok(html.includes('cdn.prod.website-files.com'));
 assert.ok(!html.includes('alt="Hipercard"'));
 assert.match(html,/Opções e condições de pagamento confirmadas no checkout da InfinitePay/);
 assert.match(html,/id="vellor-support-toggle"/);
 assert.match(html,/vellor-support\.js\?v=20261124-support-v2/);
 assert.match(html,/vellor-support\.css\?v=20261127-gradient/);
 assert.match(css,/\.vellor-footer-faq/);
 assert.ok(chatjs.includes('/api/support/chat'));
 assert.ok(fs.existsSync(path.join(root,'public/vellor-support.css')));
});

test('catálogo e cotação exigem fornecedor ativo, disponibilidade e preço válido',()=>{const api=fs.readFileSync(path.join(root,'app/api/catalog/route.js'),'utf8'),commerce=fs.readFileSync(path.join(root,'lib/commerce.js'),'utf8');const rules=fs.readFileSync(path.join(root,'lib/catalog-query.mjs'),'utf8');for(const code of [api,commerce])assert.ok(code.includes('CATALOG_WHERE')&&code.includes('CATALOG_FROM'));assert.ok(rules.includes("s.status='active'")&&rules.includes('v.supplier_available')&&rules.includes('v.price_cents>v.supplier_cost_cents'));assert.ok(commerce.includes('p.supplier_available')&&commerce.includes('p.price_cents>p.supplier_cost_cents'));});
test('checkout antigo não é utilizado em produção',()=>{const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));assert.ok(!pkg.scripts.build.includes('asaas'));for(const p of ['app/admin/asaas/page.jsx','app/api/admin/asaas/route.js','app/api/asaas/[action]/route.js','app/api/webhooks/asaas/route.js','lib/asaas.mjs','lib/asaas-api.js','lib/asaas-reconcile.js'])assert.ok(!fs.existsSync(path.join(root,p)),p);for(const p of ['app/pagamento/grupos/page.jsx','app/admin/page.jsx','app/api/suppliers/[action]/route.js'])assert.doesNotMatch(fs.readFileSync(path.join(root,p),'utf8'),/asaas/i);});
