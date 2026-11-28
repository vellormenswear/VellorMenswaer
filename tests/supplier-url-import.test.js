import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSupplierProduct} from '../lib/supplier-product-import.mjs';
import {supplierUrl,isPublicIPv4} from '../lib/supplier-public-fetch.mjs';
import {mergeImportedRows,matchedCategory} from '../lib/supplier-import-form.mjs';
import {stockUpdates} from '../lib/supplier-stock-plan.mjs';
import {readFileSync} from 'node:fs';
const base='https://supplier.example.com/item';
const doc=x=>'<script type="application/ld+json">'+JSON.stringify(x)+'</script>';
const variant=(color,size,availability,quantity)=>({'@type':'Product',color,size,image:'/img.png',offers:{'@type':'Offer',price:'12.99',availability,inventoryLevel:{'@type':'QuantitativeValue',value:quantity}}});
const group=children=>({'@type':'ProductGroup',name:'Tênis QA',description:'<b>Descrição</b>',category:'Tênis',image:['/main.png'],hasVariant:children});
test('extracts only explicit color/size stock; no price, SKU or guessed quantities',()=>{
 const p=parseSupplierProduct(doc(group([variant('Preto','39','https://schema.org/InStock',12),variant('Preto','40','https://schema.org/OutOfStock',0),variant('Branco','39','https://schema.org/InStock',null)])),base);
 assert.equal(p.name,'Tênis QA');assert.equal(p.description,'Descrição');assert.deepEqual(p.photos,['https://supplier.example.com/main.png']);
 assert.deepEqual(p.variants.map(v=>[v.label,v.sizes[0],v.reported_stock,v.supplier_available]),[['Preto','39',12,true],['Preto','40',0,false],['Branco','39',null,true]]);
 assert.ok(!JSON.stringify(p).includes('12.99'));assert.ok(p.variants.every(v=>!Object.hasOwn(v,'price')&&!Object.hasOwn(v,'sku')&&!Object.hasOwn(v,'cost_cents')));
});
test('unknown or partial structured data is not converted into stock or complete variations',()=>{
 const p=parseSupplierProduct(doc(group([variant('Preto','39','PreOrder',null),variant('Branco','','InStock',2)])),base);
 assert.equal(p.variants_incomplete,true);assert.deepEqual(p.variants,[]);
 const q=parseSupplierProduct(doc({'@type':'Product',name:'Item',offers:{'@type':'Offer',availability:'PreOrder'}}),base);
 assert.equal(q.variants[0].supplier_available,null);assert.equal(q.variants[0].reported_stock,null);assert.equal(q.variants[0].image_url,'');
 assert.throws(()=>parseSupplierProduct(doc(group([variant('Preto','39','InStock',1),variant('preto','39','OutOfStock',0)])),base),/ambíguas/);
 assert.throws(()=>parseSupplierProduct('<html>sem produto</html>',base));
});
test('rejects nonpublic URLs and IP destinations',()=>{
 for(const url of ['http://supplier.com','https://127.0.0.1/a','https://2130706433/','https://[::1]/','https://user:pass@supplier.com','https://supplier.com:8080','https://metadata.google.internal'])assert.throws(()=>supplierUrl(url));
 for(const ip of ['127.0.0.1','169.254.169.254','192.168.1.3','100.64.1.1','10.0.0.2','172.16.1.1','0.0.0.0','224.1.1.1','::1','::ffff:127.0.0.1'])assert.equal(isPublicIPv4(ip),false,ip);
 assert.equal(isPublicIPv4('8.8.8.8'),true);assert.equal(supplierUrl(base).href,base);
});
test('import preserves manually entered prices and creates only reported combinations',()=>{
 const existing=[{id:'a',label:'Preto',sizes:['39'],cost:'50',sale:'100',reported_stock:5,supplier_available:true}];
 const incoming=[{label:'Preto',sizes:['39'],reported_stock:0,supplier_available:false},{label:'Branco',sizes:['40'],reported_stock:null,supplier_available:null}];
 const next=mergeImportedRows(existing,incoming,{create:()=>({cost:'',sale:'',supplier_available:true}),limit:30});
 assert.equal(next[0].id,'a');assert.equal(next[0].cost,'50');assert.equal(next[0].sale,'100');assert.equal(next[0].reported_stock,0);assert.equal(next[1].cost,'');assert.equal(next[1].supplier_available,null);
 assert.equal(matchedCategory([{id:'a',name:'Tênis'},{id:'b',name:'Tênis'}],'Tênis'),'');
});
test('sync never zeros omitted sizes or updates legacy, inactive or ambiguous variants',()=>{
 const local=[{id:'a',label:'Preto',sizes:['39'],active:true,reported_stock:5,supplier_available:true},{id:'b',label:'Preto',sizes:['40'],active:true,reported_stock:9,supplier_available:true},{id:'c',label:'Branco',sizes:['39','40'],active:true},{id:'d',label:'Azul',sizes:['39'],active:false}];
 const remote=[{label:'Preto',sizes:['39'],reported_stock:0,supplier_available:false},{label:'Branco',sizes:['39'],reported_stock:0,supplier_available:false},{label:'Azul',sizes:['39'],reported_stock:2,supplier_available:true}];
 assert.deepEqual(stockUpdates(local,remote),[{id:'a',reported_stock:0,supplier_available:false}]);assert.deepEqual(stockUpdates(local,[]),[]);assert.deepEqual(stockUpdates(local,[remote[0],remote[0]]),[]);
 assert.deepEqual(stockUpdates(local,[{label:'Preto',sizes:['39'],reported_stock:null,supplier_available:false}]),[{id:'a',reported_stock:null,supplier_available:false}]);
});
test('protected routes, separate private source and existing editors; no financial columns changed by synchronization',()=>{
 const read=p=>readFileSync(p,'utf8');
 assert.match(read('app/api/product-import/route.js'),/requireRole\(req,\['admin','super_admin','supplier'\]\)/);
 assert.match(read('app/api/supplier-stock-sync/route.js'),/originGuard\(req\)/);assert.match(read('app/api/supplier-stock-sync/route.js'),/syncSelectedSupplierStock\(x.slug\)/);
 assert.match(read('db/025_supplier_product_sources.sql'),/REFERENCES supplier_submissions/);
 for(const p of ['components/ProductEditor.jsx','components/SupplierListings.jsx'])assert.match(read(p),/<ProductUrlImport/);
 assert.doesNotMatch(read('lib/supplier-stock-sync.js'),/price_cents|supplier_cost_cents/);
 assert.match(read('lib/supplier-stock-sync.js'),/updated_at<=\$5::timestamptz/);
});
