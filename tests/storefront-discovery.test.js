
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('public/vitrine.html'),js=read('public/vellor-approved.js'),css=read('public/vellor-approved.css');
const catalog=JSON.parse(read('data/catalogo-nacional.json')).filter(p=>p.public_ready&&Number.isFinite(p.price_brl));
const models=[...new Map(catalog.map(p=>[p.slug,p])).values()];
const minPrice=model=>Math.min(...catalog.filter(p=>p.slug===model.slug).map(p=>Math.round(p.price_brl*100)));
test('vitrine usa uma unica fileira horizontal com navegacao acessivel',()=>{
 assert.equal((html.match(/id="grid"/g)||[]).length,1);
 assert.match(html,/id="grid"[^>]*tabindex="0"/);
 assert.match(html,/class="grid vellor-product-rail"/);
 assert.match(html,/id="vellor-products-prev"/);
 assert.match(html,/id="vellor-products-next"/);
 assert.match(css,/#grid\.vellor-product-rail\s*\{[^}]*display:flex/);
 assert.match(css,/scroll-snap-type:x mandatory/);
 assert.ok(js.includes('slideProducts(direction)'));
 assert.ok(js.includes("addEventListener('scroll',updateProductNav"));
});
test('categorias ilustradas so usam fotos reais e disponiveis da VELLOR',()=>{
 assert.match(html,/id="vellor-category-rail"/);
 assert.match(js,/function renderDiscovery\(\)/);
 assert.match(js,/product.image_url/);
 for(const name of ['Vestuário','Relógios','Calçados','Acessórios','Vestuário Esportivo']){
  assert.ok(js.includes("name:'"+name+"'"));
  assert.ok(models.some(p=>p.category===name),'Categoria sem produto: '+name);
  const p=models.find(p=>p.category===name);
  assert.ok(fs.existsSync(path.join(root,'public',p.image_url.slice(1))));
 }
 assert.doesNotMatch(js,/unsplash\.com|placeholder\.com/);
});
test('navegue por preco usa 5 faixas que cobrem todos os modelos, sem inventar descontos',()=>{
 assert.match(html,/Navegue por preço/);
 assert.match(html,/id="vellor-price-rail"/);
 const bands=[[0,5999],[6000,8999],[9000,11999],[12000,15999],[16000,Infinity]];
 const prices=models.map(minPrice);
 for(const p of prices)assert.equal(bands.filter(([a,b])=>p>=a&&p<=b).length,1,'Preco nao coberto: '+p);
 for(const [a,b] of bands)assert.ok(prices.some(p=>p>=a&&p<=b),'Faixa vazia: '+a+'-'+b);
 assert.ok(js.includes('selectedPriceBand'));
 assert.ok(js.includes('lowestModelPrice(p)'));
});
test('codigo da vitrine nao tem erro de sintaxe JavaScript',()=>{
 assert.doesNotThrow(()=>new Function(js));
});
test('carrinho, pagamento, FAQ e atendimento continuam presentes',()=>{
 for(const symbol of ['function openCart()','function renderCart()','function goCheckout()','function showProduct('])assert.ok(js.includes(symbol));
 assert.ok(html.includes('id="cart-page"'));
 assert.ok(html.includes('id="vellor-faq-heading"'));
 assert.ok(html.includes('id="vellor-support-toggle"'));
});
