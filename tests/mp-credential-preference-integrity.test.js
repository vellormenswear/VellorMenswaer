import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkoutCreationIntegrity} from '../lib/mp-checkout-creation-integrity.mjs';

const sellerId='3854288750',clientId='2155048173380219';
const request={items:[{title:'Produto de teste VELLOR',unit_price:20,quantity:1,currency_id:'BRL'}]};
const preference={id:'3854288750-example',collector_id:sellerId,client_id:clientId,
 items:request.items,marketplace_fee:0,live_mode:false,
 init_point:'https://www.mercadopago.com.br/checkout/v1/redirect/test'};
const verify=(response,req=request)=>checkoutCreationIntegrity({
 preference:response,request:req,sellerId,clientId
});
test('preference without split passes with authentic collector and application',()=>{
 const result=verify(preference);
 assert.equal(result.ok,true);assert.equal(result.checks.provider_live_mode,false);
});
test('mismatched seller or application blocks preference before checkout',()=>{
 assert.equal(verify({...preference,collector_id:'999'}).code,'PREFERENCE_COLLECTOR_MISMATCH');
 assert.equal(verify({...preference,client_id:'999'}).code,'PREFERENCE_APPLICATION_MISMATCH');
});
test('mismatched totals, currency, fee or reference block the preference',()=>{
 assert.equal(verify({...preference,items:[{quantity:1,unit_price:19,currency_id:'BRL'}]}).code,'PREFERENCE_AMOUNT_MISMATCH');
 assert.equal(verify({...preference,items:[{quantity:1,unit_price:20,currency_id:'USD'}]}).code,'PREFERENCE_AMOUNT_MISMATCH');
 assert.equal(verify({...preference,marketplace_fee:1}).code,'PREFERENCE_FEE_MISMATCH');
 assert.equal(verify({...preference,external_reference:'wrong'},{...request,external_reference:'right'}).code,'PREFERENCE_REFERENCE_MISMATCH');
});
test('split fee must match exactly',()=>{
 const req={...request,marketplace_fee:1};
 assert.equal(verify({...preference,marketplace_fee:1},req).ok,true);
});
test('both routes validate OAuth identity and preference integrity',()=>{
 const isolated=readFileSync('app/api/admin/mp-isolated-test/route.js','utf8');
 const real=readFileSync('app/api/marketplace/[action]/route.js','utf8');
 for(const source of [isolated,real]){
  assert.match(source,/oauthSellerId\(token\)/);
  assert.match(source,/checkoutCreationIntegrity\(/);
 }
});
