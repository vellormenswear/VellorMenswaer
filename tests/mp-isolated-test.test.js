import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isolatedPreferencePayload,isIsolatedTestPreference,getTestMode} from '../lib/mp-isolated-test.mjs';
test('preferencia simples usa somente items sem callbacks e sem comissao',()=>{
 const p=isolatedPreferencePayload('simple');
 assert.deepEqual(Object.keys(p),['items']);
 assert.equal(p.items[0].unit_price,20);
});
test('preferencia comparativa tem mesmo item mas comissao separada',()=>{
 const simple=isolatedPreferencePayload('simple'),split=isolatedPreferencePayload('split');
 assert.deepEqual(simple.items,split.items);
 assert.equal(split.marketplace_fee,1);
 assert.equal(getTestMode(split),'split');
 assert.equal(getTestMode(simple),'simple');
});
test('o diagnostico so acessa preferencia criada para o mesmo vendedor',()=>{
 assert.equal(isIsolatedTestPreference({collector_id:'123',
  items:[{title:'Produto de teste VELLOR',unit_price:20,quantity:1}],marketplace_fee:1},'123'),true);
 assert.equal(isIsolatedTestPreference({collector_id:'999',
  items:[{title:'Produto de teste VELLOR',unit_price:20,quantity:1}]},'123'),false);
});
test('somente administradores no ambiente sandbox podem criar teste',()=>{
 const route=readFileSync('app/api/admin/mp-isolated-test/route.js','utf8');
 assert.match(route,/requireRole\(req,\['super_admin','admin'\]\)/);
 assert.match(route,/MP_MODE==='sandbox'/);
 assert.match(route,/MP_SANDBOX_TEST_SELLER_USER_ID/);
 assert.match(route,/token\.startsWith\('APP_USR-'\)/);
 assert.match(route,/checkoutProLink\(pref\)/);
 assert.ok(!route.includes('INSERT INTO orders'));
 assert.ok(!route.includes('UPDATE orders'));
 assert.ok(!route.includes('reconcilePayment('));
});
