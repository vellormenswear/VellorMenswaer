import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {asaasSandboxConfigured,asaasReady,validWalletId,asaasPrimaryWalletId,asaasUrl,buildAsaasCheckout,paidAsaasPayment} from '../lib/asaas.mjs';
const a='550e8400-e29b-41d4-a716-446655440000';
const b='11111111-1111-4111-8111-111111111111';
const env={ASAAS_BASE_URL:'https://api-sandbox.asaas.com/v3',ASAAS_API_KEY:'$aact_test_key_for_testing_only',
 ASAAS_CHECKOUT_ENABLED:'true',ASAAS_WEBHOOK_TOKEN:'1234567890abcdef1234567890abcdef',
 SITE_URL:'https://vellormenswear.vercel.app',DATABASE_URL:'postgres://test',
 ASAAS_SANDBOX_TEST_CUSTOMER_EMAIL:'buyer@example.com'};
test('sandbox e identificacao da conta de teste nao libera pagamentos reais',()=>{
 assert.equal(asaasSandboxConfigured(env),true);
 assert.equal(asaasReady(env,{role:'customer',email:'buyer@example.com'}),true);
 for(const x of [{ASAAS_BASE_URL:'https://api.asaas.com/v3'},{ASAAS_API_KEY:''},
  {ASAAS_CHECKOUT_ENABLED:'false'},{ASAAS_WEBHOOK_TOKEN:''},
  {ASAAS_SANDBOX_TEST_CUSTOMER_EMAIL:''}])
  assert.equal(asaasReady({...env,...x},{role:'customer',email:'buyer@example.com'}),false);
 assert.equal(asaasReady(env,{role:'customer',email:'wrong@example.com'}),false);
 assert.equal(asaasReady(env,{role:'supplier',email:'buyer@example.com'}),false);
});
test('Asaas cobra na VELLOR R$ 170 e repassa R$ 100 ao fornecedor',()=>{
 const g=[{amount_cents:17000,supplier_amount_cents:10000,wallet_id:a}];
 const s=buildAsaasCheckout(g,{batchId:b,site:'https://vellormenswear.vercel.app'});
 assert.equal(s.total_cents,17000);assert.equal(s.supplier_cents,10000);
 assert.deepEqual(s.payload.billingTypes,['PIX','CREDIT_CARD']);
 assert.deepEqual(s.payload.chargeTypes,['DETACHED']);
 assert.deepEqual(s.payload.items,[{name:'Produtos da VELLOR — grupo 1',quantity:1,value:170}]);
 assert.deepEqual(s.payload.splits,[{walletId:a,fixedValue:100}]);
 assert.equal(s.payload.externalReference,b);
 assert.ok(!JSON.stringify(s.payload).includes('marketplace_fee'));
 assert.ok(!JSON.stringify(s.payload).includes('MP_CLIENT_ID'));
});
test('multiplos fornecedores e valor real em centavos',()=>{
 const x=buildAsaasCheckout([
  {amount_cents:17001,supplier_amount_cents:10001,wallet_id:a},
  {amount_cents:4209,supplier_amount_cents:2507,wallet_id:b}
 ],{batchId:b,site:'https://vellormenswear.vercel.app'});
 assert.equal(x.total_cents,21210);assert.equal(x.supplier_cents,12508);
 assert.deepEqual(x.payload.splits.map(x=>x.fixedValue),[100.01,25.07]);
});
test('bloqueia divisão insegura e carteiras repetidas ou inexistentes',()=>{
 const base={amount_cents:17000,supplier_amount_cents:10000,wallet_id:a};
 const args={batchId:b,site:'https://vellormenswear.vercel.app'};
 assert.throws(()=>buildAsaasCheckout([{...base,supplier_amount_cents:17000}],args));
 assert.throws(()=>buildAsaasCheckout([{...base,wallet_id:'invalid'}],args));
 assert.throws(()=>buildAsaasCheckout([base,base],args));
 assert.throws(()=>buildAsaasCheckout([base],{...args,site:'http://wrong'}));
 assert.equal(validWalletId(a),true);
 assert.equal(validWalletId('1'),false);
 assert.equal(asaasUrl(a),'https://asaas.com/checkoutSession/show?id='+a);
 assert.equal(asaasUrl('https://evil.com'),null);
});
test('pagamento precisa estar quitado, possuir sessao e valor exatos',()=>{
 const id='checkout_id';
 const pay={id:'pay_test',status:'RECEIVED',checkoutSession:id,value:170};
 assert.equal(paidAsaasPayment(pay,id,17000),true);
 assert.equal(paidAsaasPayment({...pay,status:'PENDING'},id,17000),false);
 assert.equal(paidAsaasPayment({...pay,checkoutSession:'other'},id,17000),false);
 assert.equal(paidAsaasPayment({...pay,value:17},id,17000),false);
 assert.equal(paidAsaasPayment({...pay,deleted:true},id,17000),false);
});
test('checkout e webhook Asaas exigem seguranca e consultas oficiais',()=>{
 const checkout=readFileSync(new URL('../app/api/asaas/[action]/route.js',import.meta.url),'utf8');
 const webhook=readFileSync(new URL('../app/api/webhooks/asaas/route.js',import.meta.url),'utf8');
 const reconcile=readFileSync(new URL('../lib/asaas-reconcile.js',import.meta.url),'utf8');
 assert.match(checkout,/asaasReady\(process.env,u\)/);
 assert.match(checkout,/quoteCart\(x.items,x.coupon\)/);
 assert.match(checkout,/wallet_id/);
 assert.match(webhook,/asaas-access-token/);
 assert.match(webhook,/secureCompare\(token,expected\)/);
 assert.match(webhook,/reconcileAsaasBatch\(batch\)/);
 assert.match(reconcile,/checkoutSession/);
 assert.match(reconcile,/FOR UPDATE/);
 assert.match(reconcile,/VALUES\(\$1,'asaas'/);
});

test('API e pagina de finalizacao compartilham o contrato de resposta do Asaas',()=>{
 const route=readFileSync(new URL('../app/api/asaas/[action]/route.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../app/finalizar/page.jsx',import.meta.url),'utf8');
 const groups=readFileSync(new URL('../app/pagamento/grupos/page.jsx',import.meta.url),'utf8');
 assert.match(route,/checkout_url:created\.checkout_url,group_count:list\.length,provider:'asaas',mode:'sandbox'/);
 assert.match(page,/r\.checkout_id\|\|!r\.checkout_url/);
 assert.match(page,/group_count:Number\(r\.group_count\)\|\|0/);
 assert.doesNotMatch(page,/Array\.isArray\(r\.groups\)/);
 assert.doesNotMatch(groups,/MERCADO PAGO/i);
});

test('recuperar wallet principal no formato oficial do Asaas',()=>{
 const official='0000c712-0a0b-a0b0-0000-031e7ac51a2';
 assert.equal(validWalletId(official),true);
 assert.equal(asaasPrimaryWalletId({object:'list',hasMore:false,totalCount:1,data:[{object:'wallet',id:official}]}),official);
 assert.equal(asaasPrimaryWalletId({id:a}),a);
 assert.equal(asaasPrimaryWalletId({walletId:a}),a);
});
test('nunca escolher carteira ambigua ou invalida',()=>{
 assert.equal(asaasPrimaryWalletId({data:[]}),null);
 assert.equal(asaasPrimaryWalletId({data:[{id:a},{id:b}],totalCount:2}),null);
 assert.equal(asaasPrimaryWalletId({data:[{id:a}],hasMore:true}),null);
 assert.equal(asaasPrimaryWalletId({data:[{id:a}],totalCount:2}),null);
 assert.equal(asaasPrimaryWalletId({data:[{id:'invalido'}]}),null);
 assert.equal(validWalletId('00000000-0000-0000-0000-000000000000'),false);
});
