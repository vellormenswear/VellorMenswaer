import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkoutRequestHash,couponHasCapacity} from '../lib/checkout-attempt.mjs';
const x={address_id:'a',coupon:' TEST ',items:[{sku:'A',qty:1,size:'M'},{sku:'B',qty:2}]};
test('chave da tentativa vincula endereço, cupom e itens, independentemente da ordem',()=>{
 assert.equal(checkoutRequestHash(x),checkoutRequestHash({...x,coupon:'test',items:[...x.items].reverse()}));
 for(const change of [{address_id:'b'},{coupon:'another'},{items:[{sku:'A',qty:2,size:'M'}]}])assert.notEqual(checkoutRequestHash(x),checkoutRequestHash({...x,...change}));
 assert.throws(()=>checkoutRequestHash({...x,items:[]}));
});
test('cupom considera utilizações e reservas sem exceder o limite',()=>{
 assert.equal(couponHasCapacity({used_count:1,max_uses:3},1),true);
 assert.equal(couponHasCapacity({used_count:1,max_uses:3},2),false);
 assert.equal(couponHasCapacity({used_count:3,max_uses:3}),false);
 assert.equal(couponHasCapacity({used_count:3,max_uses:null},20),true);
});
test('tentativa e reserva são transacionais e a conciliação aceita criação incerta somente após consulta oficial',()=>{
 const route=readFileSync('app/api/infinitepay/[action]/route.js','utf8');
 assert.ok(route.indexOf('INSERT INTO checkout_attempts')<route.indexOf('INSERT INTO supplier_order_groups'));
 assert.match(route,/COUNT\(DISTINCT checkout_batch_id\)/);
 const reconcile=readFileSync('lib/infinitepay-reconcile.js','utf8');
 assert.ok(reconcile.indexOf('verifiedInfinitepayPayment(paid')<reconcile.indexOf("['creating','pending','failed'].includes(current.status)"));
 assert.match(reconcile,/if\(g.coupon_id&&stockOk\)/);
 const schema=readFileSync('db/016_checkout_attempts.sql','utf8');
 assert.match(schema,/PRIMARY KEY\(customer_id,idempotency_key\)/);
});
