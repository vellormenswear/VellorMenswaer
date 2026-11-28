import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSupplierPage,supplierRedirect,supplierHttpError} from '../lib/supplier-public-fetch.mjs';
import {safeImportError} from '../lib/supplier-import-errors.mjs';
import {parseSupplierProduct,shopifyProductEndpoint,parseShopifyProduct,combineShopifyProduct} from '../lib/supplier-product-import.mjs';
import {readSupplierProduct} from '../lib/read-supplier-product.mjs';
const base='https://store.example.com/products/tenis';
const meta='<html><head><meta content="product" property="og:type"><meta property="og:title" content="Tênis &amp; Cia"><meta property="og:description" content="Modelo azul"><meta property="og:image" content="/foto.jpg"><meta property="product:price:amount" content="9999"></head><body></body></html>';
const shop={title:'Tênis QA',handle:'tenis',description:'<p>Descrição</p>',type:'Calçados',images:['/foto.jpg'],options:[{name:'Cor',position:1},{name:'Tamanho',position:2}],variants:[{options:['Azul','39'],available:true,price:123456},{options:['Azul','40'],available:false,price:234567}]};
const shopHtml=meta.replace('</head>','<script>Shopify.shop = "fixture";</script></head>');
test('safe redirects resolve and pin each destination, reject private addresses, loops and downgrade',async()=>{
 const visited=[],resolve=async h=>{visited.push(h);return ['8.8.8.8']};
 const page=await fetchSupplierPage(base,{resolve,read:async(u,ip)=>{assert.equal(ip,'8.8.8.8');return u.hostname==='store.example.com'?{redirect:'https://other.example.com/p'}:{url:u.href,html:'ok'}}});
 assert.deepEqual(visited,['store.example.com','other.example.com']);assert.equal(page.url,'https://other.example.com/p');
 assert.throws(()=>supplierRedirect(base,'http://other.example.com'),/não permitido/);
 assert.throws(()=>supplierRedirect(base,'https://127.0.0.1'),/não permitido/);
 await assert.rejects(fetchSupplierPage(base,{resolve:async h=>h==='store.example.com'?['8.8.8.8']:['127.0.0.1'],read:async()=>({redirect:'https://other.example.com/p'})}),e=>e.code==='UNSAFE_ADDRESS');
 await assert.rejects(fetchSupplierPage(base,{resolve,read:async()=>({redirect:base})}),e=>e.code==='REDIRECT_LOOP');
});
test('diagnostics preserve known HTTP and DNS errors without exposing raw messages or URLs',()=>{
 assert.deepEqual(safeImportError(supplierHttpError(403)),{code:'HTTP_403',message:'O fornecedor recusou a consulta automatizada.',status:403});
 assert.equal(safeImportError(supplierHttpError(404)).code,'HTTP_404');assert.equal(safeImportError(supplierHttpError(429)).code,'HTTP_429');
 assert.equal(safeImportError({code:'ENOTFOUND',message:'secret'}).code,'DNS');assert.ok(!JSON.stringify(safeImportError(Error('https://private.example.com/token'))).includes('private'));
});
test('product Open Graph metadata fills only explicit fields; no invented variants, stock or prices',()=>{
 const p=parseSupplierProduct(meta,base);assert.equal(p.name,'Tênis & Cia');assert.equal(p.description,'Modelo azul');assert.deepEqual(p.photos,['https://store.example.com/foto.jpg']);assert.equal(p.variants_incomplete,true);assert.deepEqual(p.variants,[]);assert.ok(!JSON.stringify(p).includes('9999'));
 assert.throws(()=>parseSupplierProduct(meta.replace('content="product"','content="website"'),base),e=>e.code==='NO_PRODUCT_DATA');
});
test('Shopify public Ajax parsing maps explicitly named options and only binary availability',()=>{
 const endpoint=shopifyProductEndpoint(shopHtml,base);assert.equal(endpoint,base+'.js');
 assert.equal(shopifyProductEndpoint(meta,base),null);
 const result=parseShopifyProduct(JSON.stringify(shop),endpoint,base);
 assert.deepEqual(result.variants.map(v=>[v.label,v.sizes[0],v.supplier_available,v.reported_stock]),[['Azul','39',true,null],['Azul','40',false,null]]);
 assert.ok(!JSON.stringify(result).includes('123456'));
 assert.equal(parseShopifyProduct(JSON.stringify({...shop,options:[...shop.options,{name:'Material',position:3}]}),endpoint,base).variants_incomplete,true);
 assert.throws(()=>parseShopifyProduct(JSON.stringify({...shop,handle:'outro'}),endpoint,base),e=>e.code==='SHOPIFY_PRODUCT_MISMATCH');
});
test('JSON-LD quantities are preserved only when the same combination is explicitly identified',()=>{
 const p={name:'',description:'',category:'',photos:[],variants:[{label:'Azul',sizes:['39'],reported_stock:4,supplier_available:true}],variants_incomplete:false};
 const s=parseShopifyProduct(JSON.stringify(shop),base+'.js',base);
 assert.deepEqual(combineShopifyProduct(p,s).variants.map(v=>v.reported_stock),[4,null]);
});
test('shared extractor uses documented endpoint and safely falls back on partial metadata when blocked',async()=>{
 let calls=[];const fetchPage=async(url,opts)=>{calls.push([url,opts.kind,opts.deadline]);return {url,html:opts.kind==='json'?JSON.stringify(shop):shopHtml}};
 const p=await readSupplierProduct(base,{fetchPage});assert.equal(p.product.variants.length,2);assert.equal(calls.length,2);assert.equal(calls[0][2],calls[1][2]);
 const partial=await readSupplierProduct(base,{fetchPage:async(url,opts)=>{if(opts.kind==='json')throw supplierHttpError(403);return {url,html:shopHtml}}});
 assert.equal(partial.product.variants_incomplete,true);assert.equal(partial.product.name,'Tênis & Cia');
});

test('single-axis options are imported without guessing the missing color or size',()=>{
 const only={...shop,options:[{name:'Tamanho',position:1}],variants:[{options:['39'],available:true},{options:['40'],available:false}]};
 const p=parseShopifyProduct(JSON.stringify(only),base+'.js',base);
 assert.equal(p.variants_incomplete,true);
 assert.deepEqual(p.variants.map(v=>[v.label,v.sizes[0],v.supplier_available]),[['','39',true],['','40',false]]);
 const q=parseSupplierProduct('<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Tênis'})+'</script>',base);
 assert.equal(q.variants_incomplete,true);
 assert.deepEqual(combineShopifyProduct(q,p).variants,p.variants);
});

test('Mercado Livre and Shopee use public structured product data without claiming seller inventory',async()=>{
 const schema={'@type':'Product',name:'Tênis QA',color:'Azul',size:'39',offers:{'@type':'Offer',availability:'InStock',inventoryLevel:{value:99}}};
 const html='<script type="application/ld+json">'+JSON.stringify(schema)+'</script>';
 for(const url of ['https://produto.mercadolivre.com.br/MLB-12345','https://shopee.com.br/product/123/456']){
  const r=await readSupplierProduct(url,{fetchPage:async()=>({url,html})});
  assert.equal(r.product.name,'Tênis QA');assert.equal(r.product.variants[0].supplier_available,true);assert.equal(r.product.variants[0].reported_stock,null);
  await assert.rejects(readSupplierProduct(url,{fetchPage:async()=>{throw supplierHttpError(403)}}),e=>e.code==='MARKETPLACE_ACCESS_REQUIRED'&&e.status===403);
 }
});
test('WooCommerce public Store API verifies product permalink and product ID before importing variants',async()=>{
 const url='https://store.example.com/produto/tenis/',endpoint='https://store.example.com/wp-json/wc/store/v1/products?slug=tenis';
 const wc={id:123,name:'Tênis Woo QA',permalink:url,description:'<b>Descrição</b>',images:[{src:'https://store.example.com/foto.jpg'}],categories:[{name:'Calçados'}]};
 const vars=[{attributes:{attribute_pa_cor:'preto',attribute_pa_tamanho:'39'},is_in_stock:true,display_price:9876},{attributes:{attribute_pa_cor:'preto',attribute_pa_tamanho:'40'},is_in_stock:false,display_price:9876}];
 const html='<html><head></head><body class="woocommerce"><form class="variations_form" data-product_id="123" data-product_variations="'+JSON.stringify(vars).replace(/"/g,'&quot;')+'"></form></body></html>';
 const result=await readSupplierProduct(url,{fetchPage:async(u,o)=>{if(o.kind==='json'){assert.equal(u,endpoint);return {url:u,html:JSON.stringify([wc])}}return {url:u,html}}});
 assert.equal(result.product.name,wc.name);assert.deepEqual(result.product.variants.map(v=>[v.label,v.sizes[0],v.supplier_available,v.reported_stock]),[['preto','39',true,null],['preto','40',false,null]]);assert.ok(!JSON.stringify(result).includes('9876'));
 await assert.rejects(readSupplierProduct(url,{fetchPage:async(u,o)=>({url:u,html:o.kind==='json'?JSON.stringify([{...wc,permalink:'https://store.example.com/produto/outro/'}]):html})}),e=>e.code==='WOO_PRODUCT_MISMATCH');
 const partial=await readSupplierProduct(url,{fetchPage:async(u,o)=>({url:u,html:o.kind==='json'?JSON.stringify([wc]):html.replace('data-product_id="123"','data-product_id="456"')})});assert.equal(partial.product.variants_incomplete,true);assert.deepEqual(partial.product.variants,[]);
});
