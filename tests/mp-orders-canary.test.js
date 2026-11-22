import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canaryOrderPayload,inspectCanaryOrder,orderIdValid} from '../lib/mp-orders-canary.mjs';
const uuid='abcdef01-abcd-4abc-8abc-abcdef012345';
const reference=mode=>`vellor-orders-canary-${mode}-${uuid}`;
const order=(mode,changes={})=>({id:'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9',external_reference:reference(mode),user_id:'123',
 integration_data:{application_id:'456'},currency:'BRL',total_amount:'20.00',marketplace_fee:mode==='split'?'10.00':'0.00',status:'created',status_detail:'created',total_paid_amount:'0.00',...changes});
test('Orders API canary sem split é público convidado sem payer',()=>{
 const p=canaryOrderPayload('simple',reference('simple'));
 assert.equal(p.type,'online');assert.equal(p.processing_mode,'manual');
 assert.equal(p.total_amount,'20.00');assert.equal(p.marketplace_fee,undefined);assert.equal(p.payer,undefined);
 assert.deepEqual(p.items,[{title:'Teste VELLOR Orders API',quantity:1,unit_price:'20.00'}]);
});
test('Orders API canary com split usa taxa fixa de R$ 10',()=>{
 const p=canaryOrderPayload('split',reference('split'));
 assert.equal(p.marketplace_fee,'10.00');assert.equal(p.total_amount,'20.00');
 assert.throws(()=>canaryOrderPayload('split',reference('simple')));
});
test('resposta pertence ao vendedor integrador e ao teste sandbox',()=>{
 const good=inspectCanaryOrder(order('split'),{sellerId:'123',clientId:'456'});
 assert.equal(good.safe,true);
 for(const field of ['user_id','currency','total_amount','marketplace_fee','id','external_reference','integration_data']){
  const bad={...order('split')};
  const variants={user_id:'999',currency:'USD',total_amount:'300.00',marketplace_fee:'0.00',id:'ORD01KS5AJ6HTK2HRQ3XJ3C2JCKP9',external_reference:'attacker',integration_data:{application_id:'789'}};
  bad[field]=variants[field];assert.equal(inspectCanaryOrder(bad,{sellerId:'123',clientId:'456'}).safe,false,field);
 }
 assert.equal(orderIdValid('ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9'),true);
 assert.equal(orderIdValid('../orders'),false);
});
test('o teste isolado não inclui carteira e não altera pedidos VELLOR',()=>{
 const src=readFileSync(new URL('../app/api/admin/mp-orders-canary/route.js',import.meta.url),'utf8');
 assert.match(src,/requireRole\(req,\['super_admin'\]\)/);
 assert.match(src,/MP_MODE==='sandbox'/);
 assert.match(src,/MP_LIVE_ENABLED!=='true'/);
 assert.match(src,/mpRequest\('\/v1\/orders'/);
 assert.match(src,/inspectCanaryOrder\(order/);
 assert.equal(src.includes('INSERT INTO'),false);
 assert.equal(src.includes('UPDATE supplier_order_groups'),false);
 assert.equal(src.includes('reconcilePayment('),false);
});
