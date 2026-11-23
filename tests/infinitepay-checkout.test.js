import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {infinitepayConfigured,infinitepayReady,buildInfinitepayCheckout,verifiedInfinitepayPayment,safeInfiniteCheckoutLink} from '../lib/infinitepay.mjs';
const id='550e8400-e29b-41d4-a716-446655440000';
const env={INFINITEPAY_API_KEY:'inchk_test_only_not_a_real_key_1234',INFINITEPAY_HANDLE:'minha-loja',INFINITEPAY_CHECKOUT_ENABLED:'true',STORE_OPEN_FOR_ORDERS:'true',INFINITEPAY_TEST_CUSTOMER_EMAIL:'cliente@example.com',DATABASE_URL:'postgres://test',SITE_URL:'https://vellormenswear.vercel.app'};
test('checkout real fica bloqueado sem autorizar apenas o cliente de teste',()=>{
 assert.equal(infinitepayConfigured(env),true);
 assert.equal(infinitepayReady(env,{role:'customer',email:'cliente@example.com'}),true);
 for(const part of [{INFINITEPAY_CHECKOUT_ENABLED:'false'},{STORE_OPEN_FOR_ORDERS:'false'},{INFINITEPAY_API_KEY:''},{INFINITEPAY_HANDLE:''},{INFINITEPAY_TEST_CUSTOMER_EMAIL:''}])
  assert.equal(infinitepayReady({...env,...part},{role:'customer',email:'cliente@example.com'}),false);
 assert.equal(infinitepayReady(env,{role:'customer',email:'outro@example.com'}),false);
});
test('links de uso unico, expiracao, soma em centavos e webhook',()=>{
 const b=buildInfinitepayCheckout([{amount_cents:17000,supplier_amount_cents:10000}],
 {batchId:id,site:env.SITE_URL,expiresAt:new Date(Date.now()+7200000).toISOString()});
 assert.equal(b.total_cents,17000);assert.equal(b.supplier_cents,10000);
 assert.deepEqual(b.payload.items,[{description:'VELLOR - pedido 1',price:17000,quantity:1}]);
 assert.equal(b.payload.order_nsu,id);
 assert.equal(b.payload.options.single_payment,true);
 assert.deepEqual(b.payload.webhook.events,['paid','refunded','canceled']);
 assert.ok(!JSON.stringify(b.payload).includes('splits'));
});
test('nunca aceitar aprovacao sem resultado da API e total conferido',()=>{
 const yes={success:true,paid:true,amount:17000,paid_amount:17450,capture_method:'credit_card'};
 assert.equal(verifiedInfinitepayPayment(yes,17000),true);
 assert.equal(verifiedInfinitepayPayment({...yes,amount:100},17000),false);
 assert.equal(verifiedInfinitepayPayment({...yes,paid:false},17000),false);
 assert.equal(verifiedInfinitepayPayment({...yes,success:false},17000),false);
 assert.equal(verifiedInfinitepayPayment({...yes,paid_amount:14000},17000),false);
});
test('somente links HTTPS oficiais podem ser abertos',()=>{
 assert.equal(safeInfiniteCheckoutLink('https://checkout.infinitepay.io/pay/abc'),'https://checkout.infinitepay.io/pay/abc');
 for(const uri of ['http://checkout.infinitepay.io','https://infinitepay.io.evil.com/','https://other.com','javascript:alert(1)'])
  assert.equal(safeInfiniteCheckoutLink(uri),null);
});
test('migracao preserva registros e exige repasse manual',()=>{
 const schema=readFileSync(new URL('../db/008_infinitepay.sql',import.meta.url),'utf8');
 assert.match(schema,/CREATE TABLE IF NOT EXISTS supplier_manual_payouts/);
 assert.match(schema,/awaiting_payout/);
 const webhook=readFileSync(new URL('../app/api/webhooks/infinitepay/route.js',import.meta.url),'utf8');
 assert.match(webhook,/reconcileInfinitepayBatch/);
 assert.match(webhook,/payment_check|reconcileInfinitepayBatch/);
});

test('reconciliacao nao sombreia funcao de transacao e respeita status de pedidos',()=>{
 const source=readFileSync(new URL('../lib/infinitepay-reconcile.js',import.meta.url),'utf8');
 assert.match(source,/const transactionNsu=String/);
 assert.doesNotMatch(source,/const transaction=String/);
 assert.match(source,/return transaction\\(async c=>/);
 assert.match(source,/stockOk\\?'paid':'cancel_requested'/);
 assert.match(source,/stockOk\\?'awaiting_payout':'cancel_requested'/);
});
