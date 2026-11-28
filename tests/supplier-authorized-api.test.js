import test from 'node:test';
import assert from 'node:assert/strict';
import {marketplaceListingId,readAuthorizedMeli} from '../lib/supplier-authorized-api.mjs';
const m='https://produto.mercadolivre.com.br/MLB-5291857244-calca-jeans-feminina-wide-leg-pantalona-cintura-alta-algodo-_JM?searchVariation=186977075373';
const s='https://shopee.com.br/Camisa-Masculina-Social-Slim-Fit-i.631628506.58211355781';
test('identifies exact supplied listings, not lookalike domains',()=>{
 assert.equal(marketplaceListingId(m).itemId,'MLB5291857244');
 const x=marketplaceListingId(s);assert.equal(x.shopId,'631628506');assert.equal(x.itemId,'58211355781');
 assert.throws(()=>marketplaceListingId('https://mercadolivre.com.br.example.com/MLB-5291857244-test'));
});
test('authorized endpoint maps exact pair and photos, excludes price and referential stock',async()=>{
 const calls=[];const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
 const item={id:'MLB5291857244',title:'Produto QA',price:999,pictures:[{id:'p1',secure_url:'https://cdn.example.com/a.jpg'}],variations:[{attribute_combinations:[{id:'COLOR',value_name:'Preto'},{id:'SIZE',value_name:'M'}],available_quantity:50,picture_ids:['p1']}]};
 const result=await readAuthorizedMeli(m,{accessToken:'fixture',fetchImpl:async(url,opts)=>{calls.push(url);assert.equal(opts.redirect,'error');assert.equal(opts.headers.Authorization,'Bearer fixture');return json(url.endsWith('/description')?{plain_text:'Descrição QA'}:item)}});
 assert.equal(calls.length,2);assert.deepEqual(result.product,{name:'Produto QA',description:'Descrição QA',category:'',photos:['https://cdn.example.com/a.jpg'],variants:[{label:'Preto',sizes:['M'],image_url:'https://cdn.example.com/a.jpg',supplier_available:null,reported_stock:null}],variants_incomplete:false});
});
test('missing credential and API refusal are explicit; never send unapproved requests',async()=>{
 await assert.rejects(readAuthorizedMeli(m,{fetchImpl:()=>assert.fail('no credential')}),e=>e.code==='API_AUTH_REQUIRED');
 await assert.rejects(readAuthorizedMeli(s,{accessToken:'fixture',fetchImpl:()=>assert.fail('unsupported')}),e=>e.code==='API_NOT_CONFIGURED');
 await assert.rejects(readAuthorizedMeli(m,{accessToken:'fixture',fetchImpl:()=>new Response('',{status:403})}),e=>e.code==='API_HTTP_403');
 await assert.rejects(readAuthorizedMeli(m,{accessToken:'fixture',fetchImpl:()=>new Response(JSON.stringify({id:'MLB12345'}),{headers:{'Content-Type':'application/json'}})}),e=>e.code==='API_PRODUCT_MISMATCH');
});
