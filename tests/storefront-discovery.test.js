
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
test('destaques usam uma unica fileira horizontal com navegacao acessivel',()=>{
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
test('menu textual mantém quatro principais e trinta subcategorias',()=>{
 const defaults=read('public/vellor-category-defaults.js');
 const {tree,mapping}=new Function(defaults+';return {tree:DEFAULT_CATEGORY_TREE,mapping:DEFAULT_MODEL_CATEGORIES}')();
 assert.equal(tree.filter(c=>!c.parent_slug).length,4);
 assert.equal(tree.filter(c=>c.parent_slug).length,30);
 assert.deepEqual(tree.filter(c=>!c.parent_slug).map(c=>c.name),['Vestuário','Relógios','Calçados','Acessórios']);
 assert.equal(tree.find(c=>c.slug==='vestuario-esportivo').parent_slug,'vestuario');
 assert.equal(new Set(tree.map(c=>c.slug)).size,34);
 assert.ok(tree.every(c=>!c.parent_slug||tree.some(p=>p.slug===c.parent_slug&&!p.parent_slug)));
 assert.ok(models.every(p=>mapping[p.slug]&&tree.some(c=>c.slug===mapping[p.slug]))); 
 for(const p of models){assert.ok(fs.existsSync(path.join(root,'public',p.image_url.slice(1))))}
 assert.match(html,/id="vellor-category-rail"/);
 assert.match(js,/function renderDiscovery\(\)/);
 assert.ok(js.includes('vellor-mega-links')&&js.includes('children.map(c=>'));
 assert.doesNotMatch(js,/unsplash\.com|placeholder\.com/);
});
test('menu textual único substitui categorias ilustradas',()=>{
 const nav=html.indexOf('class="category-nav vellor-category-nav vellor-clean-nav"');
 const products=html.indexOf('id="catalog-page"');
 assert.ok(nav>0&&nav<products,'Categorias ilustradas devem aparecer antes dos produtos');
 assert.equal((html.match(/id="vellor-category-rail"/g)||[]).length,1);
 assert.ok(!html.includes('id="vellor-show-all"'));
 assert.ok(!html.includes('id="nav"'),'Menu textual antigo removido');
 assert.ok(!html.includes('id="descobrir"'),'Categorias inferiores duplicadas removidas');
 assert.ok(js.includes('function browseCategory(category)'));
 assert.ok(js.includes('vellor-menu-trigger ${selected?'));
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

test('setas da vitrine usam SVG e não caracteres sujeitos a emoji',()=>{
 assert.doesNotMatch(js,/↗/);
 assert.doesNotMatch(html,/<span[^>]*>[↗‹›]<\/span>/);
 assert.match(js,/<svg viewBox="0 0 24 24"[^>]*aria-hidden="true"[^>]*focusable="false"/);
 assert.equal((html.match(/class="vellor-arrow-svg"/g)||[]).length,3);
 assert.match(css,/\.vellor-category-name \.vellor-arrow-svg\{color:#d8c18c/);
 assert.match(css,/\.vellor-carousel-arrow \.vellor-arrow-svg\{width:25px;height:25px\}/);
 assert.ok(html.includes('/vellor-approved.js?v=20261124-clean-urls'));
 assert.ok(html.includes('/vellor-approved.css?v=20261124-mobile-logo-only'));
});

test('menu hover textual tem toque, teclado, links próprios e nenhuma foto de categoria',()=>{
 const config=read('next.config.mjs');assert.ok(config.includes("source:'/categorias/:categoria'")&&config.includes("source:'/categorias/:categoria/:subcategoria'"));
 const menu=js.slice(js.indexOf('function browseCategory('),js.indexOf('function slideProducts'));
 assert.ok(menu.includes("addEventListener('pointerover'")&&menu.includes("addEventListener('pointerleave'")&&menu.includes("addEventListener('click'"));
 assert.ok(menu.includes("e.key==='Escape'")&&menu.includes('aria-expanded')&&menu.includes('categoryUrl(root.slug,c.slug)'));
 assert.ok(menu.includes('categoryUrl(root.slug,\'todos\')')&&menu.includes("document.getElementById('catalog-page').hidden=isCart||invalid"));
 assert.ok(!menu.includes('<img')&&!menu.includes('vellor-category-tile'));
 assert.ok(css.includes('.vellor-mega-menu[hidden]')&&css.includes('@media(max-width:760px)'));
});

test('destaques sorteiam no máximo dois modelos distintos por categoria e não limitam o catálogo',()=>{
 const start=js.indexOf('function selectFeatured('),end=js.indexOf('function isFeaturedView()',start);
 const select=new Function(js.slice(start,end)+';return selectFeatured')();
 const roots=['vestuario','relogios','calcados','acessorios'];
 const rows=roots.flatMap(root=>Array.from({length:5},(_,i)=>({root,slug:root+i,rank:5-i})));
 const chosen=select(rows,roots,p=>p.root,p=>p.rank);
 assert.equal(chosen.length,8);assert.equal(new Set(chosen.map(p=>p.slug)).size,8);
 for(const root of roots){assert.equal(chosen.filter(p=>p.root===root).length,2);assert.ok(chosen.some(p=>p.slug===root+'4'));assert.ok(chosen.some(p=>p.slug===root+'3'));}
 assert.equal(select(rows.filter(p=>p.slug==='vestuario0'),roots,p=>p.root,p=>p.rank).length,1);
 assert.ok(js.includes('Math.random()')&&js.includes('):allItems;'));
 assert.ok(js.includes("!pageParent&&!fullCatalog")&&js.includes("routeSlug==='produtos'"));
 assert.ok(js.includes("grid.classList.toggle('vellor-product-grid',!carousel)")&&js.includes("prev.hidden=next.hidden=!carousel"));
 assert.ok(html.includes('href="/produtos"'));
 assert.match(css,/#grid\.vellor-product-grid\{display:grid;grid-template-columns:repeat\(4/);
 assert.match(css,/#grid\.vellor-product-grid\{grid-template-columns:repeat\(2/);
});

test('URLs públicas usam raiz e slugs únicos sem extensão ou prefixo',()=>{
 const config=read('next.config.mjs'),frame=read('components/Frame.jsx'),page=read('app/page.jsx');
 assert.ok(config.includes("source:'/vitrine.html',destination:'/',permanent:true"));
 assert.ok(config.includes("beforeFiles:[{source:'/',destination:'/vitrine.html'}]"));
 assert.ok(config.includes("source:'/categorias/:categoria/todos',destination:'/:categoria'"));
 assert.ok(config.includes("source:'/categorias/:categoria/:subcategoria',destination:'/:subcategoria'"));
 assert.ok(config.includes("source:'/:categoria([a-z0-9-]+)'"));
 assert.ok(!page.includes('redirect(')&&!frame.includes('/vitrine.html')&&!html.includes('href="/vitrine.html'));
 const start=js.indexOf('const categoryUrl='),end=js.indexOf(';',start)+1;
 const url=new Function(js.slice(start,end)+';return categoryUrl')();
 assert.equal(url('vestuario','camisas'),'/camisas');assert.equal(url('vestuario','todos'),'/vestuario');assert.equal(url('relogios','relogios-classicos'),'/relogios-classicos');
 assert.ok(js.includes('resolveCategoryRoute();active=pageLeaf||pageParent'));
});

test('domínio oficial não redireciona APIs nem retornos antigos de pagamento',()=>{
 const source=read('middleware.js');assert.ok(source.includes("target.hostname='vellormenswear.com.br'"));assert.ok(source.includes("path.startsWith('/api/')")&&source.includes("path.startsWith('/pagamento/')"));
 const a=js.indexOf('function resolveCategoryRoute()'),b=js.indexOf('\nresolveCategoryRoute();',a);
 const route=new Function('routeSlug','fullCatalog','categoryTree','let pageParent=null,pageLeaf=null;'+js.slice(a,b)+';resolveCategoryRoute();return {pageParent,pageLeaf}');
 const tree=[{slug:'vestuario',parent_slug:null},{slug:'camisas',parent_slug:'vestuario'},{slug:'nova',parent_slug:'vestuario'}];
 assert.deepEqual(route('camisas',false,tree),{pageParent:'vestuario',pageLeaf:'camisas'});assert.deepEqual(route('vestuario',false,tree),{pageParent:'vestuario',pageLeaf:null});assert.deepEqual(route('nova',false,tree),{pageParent:'vestuario',pageLeaf:'nova'});assert.deepEqual(route('produtos',true,tree),{pageParent:null,pageLeaf:null});assert.deepEqual(route(null,false,tree),{pageParent:null,pageLeaf:null});
});

test('logo móvel reduzida sem mover os controles originais',()=>{const header=html.slice(html.indexOf('<header class="site-header">'),html.indexOf('</header>'));const right=header.slice(header.indexOf('class="hd-right"'));assert.ok(right.includes('Ir para busca')&&right.indexOf('Ir para busca')<right.indexOf('Minha conta')&&right.indexOf('Minha conta')<right.indexOf('Abrir carrinho'));assert.equal((header.match(/aria-label="Ir para busca"/g)||[]).length,1);assert.ok(css.includes('width:min(185px,calc(100% - 284px))'));for(const width of [320,360,375,390,414,430,760]){const logo=Math.min(185,width-284);assert.ok(logo>0);assert.ok((width+logo)/2<=width-17-120-5);}});
