import test from 'node:test';
import assert from 'node:assert/strict';
import {browserProductSnapshot} from '../lib/supplier-browser-capture.mjs';
const urls=['https://shopee.com.br/product/631628506/58211355781','https://produto.mercadolivre.com.br/MLB-5291857244-calca-jeans-feminina-wide-leg-pantalona-cintura-alta-algodo-_JM'];
for(const url of urls)test('explicit browser capture supports '+new URL(url).hostname+' without importing price or stock',()=>{
 const snapshot={version:1,url,name:'Produto fictício QA',description:'Descrição QA',photos:['https://cdn.example.com/one.jpg','https://cdn.example.com/one.jpg','https://cdn.example.com/two.webp'],price:1,stock:9999};
 const {product,url:source}=browserProductSnapshot(snapshot,url);
 assert.equal(source,url);assert.deepEqual(product,{name:'Produto fictício QA',description:'Descrição QA',category:'',photos:['https://cdn.example.com/one.jpg','https://cdn.example.com/two.webp'],variants:[],variants_incomplete:true});
 assert.throws(()=>browserProductSnapshot({...snapshot,url:'https://other.example.com/'},url));
 assert.throws(()=>browserProductSnapshot({...snapshot,photos:['http://127.0.0.1/private']},url));
 assert.throws(()=>browserProductSnapshot({...snapshot,photos:Array(31).fill('https://cdn.example.com/image.jpg')},url));
 assert.throws(()=>browserProductSnapshot({...snapshot,name:''},url));
});
