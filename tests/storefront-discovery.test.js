
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
test('categorias com imagens substituem menu superior e não são duplicadas',()=>{
 const nav=html.indexOf('class="category-nav vellor-category-nav"');
 const products=html.indexOf('id="catalog-page"');
 assert.ok(nav>0&&nav<products,'Categorias ilustradas devem aparecer antes dos produtos');
 assert.equal((html.match(/id="vellor-category-rail"/g)||[]).length,1);
 assert.ok(html.includes('id="vellor-show-all"'));
 assert.ok(!html.includes('id="nav"'),'Menu textual antigo removido');
 assert.ok(!html.includes('id="descobrir"'),'Categorias inferiores duplicadas removidas');
 assert.ok(js.includes('function browseCategory(category)'));
 assert.ok(js.includes('vellor-category-tile ${currentCategory===name?'));
 assert.ok(js.includes('categoryForSearch'));
 assert.ok(!html.includes('class="vellor-carousel-controls"'));
});
test('navegue por preço foi removido sem eliminar o filtro normal',()=>{
 assert.ok(!html.includes('Navegue por preço'));
 assert.ok(!html.includes('id="vellor-price-rail"'));
 assert.ok(!js.includes('BROWSE_PRICE_BANDS'));
 assert.ok(!js.includes('browsePrice('));
 assert.ok(!js.includes('selectedPriceBand'));
 assert.ok(!css.includes('.vellor-price-tile'));
 assert.ok(html.includes('id="max-price"'));
 assert.ok(js.includes("const max=document.getElementById('max-price')")||js.includes("max=document.getElementById('max-price')"));
});
test('textura verde é uma superfície orgânica única sem mosaico',()=>{
 const texture=read('public/vellor-surface-continuous.svg');
 const internal=read('app/globals.css');
 assert.ok(texture.includes('fractalNoise'));
 assert.ok(!texture.includes('<pattern'));
 assert.ok(css.includes("background-image:url('/vellor-surface-continuous.svg')"));
 assert.ok(internal.includes("background-image:url('/vellor-surface-continuous.svg')"));
 assert.ok(css.includes('background-repeat:no-repeat'));
 assert.ok(internal.includes('background-repeat:no-repeat'));
});
test('botão de atendimento tem ícone de chat, acabamento redondo e acesso no FAQ',()=>{
 const supportCss=read('public/vellor-support.css');
 const supportJs=read('public/vellor-support.js');
 const widget=read('components/SupportWidget.jsx');
 assert.ok(html.includes('class="vellor-chat-icon"'));
 assert.ok(html.includes('class="vellor-faq-chat-cta"'));
 assert.ok(supportCss.includes('border-radius:9999px'));
 assert.ok(supportCss.includes("vellor-surface-continuous.svg"));
 assert.ok(supportJs.includes('IntersectionObserver'));
 assert.ok(supportJs.includes('vellor-support-on-faq'));
 assert.ok(widget.includes('vellor-support-fab-icon'));
 assert.doesNotThrow(()=>new Function(supportJs));
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
