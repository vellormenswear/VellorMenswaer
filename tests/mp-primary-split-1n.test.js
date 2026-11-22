import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {primarySplitSandboxReady,primarySplitPlan,primarySplitPixPayload,
 hasActiveConsent,inspectPrimarySplitOrder,validReceiverId} from '../lib/mp-primary-split-1n.mjs';

const owner='1234567890';
const partner='550e8400-e29b-41d4-a716-446655440000';
const ref='vellor-primary-1n-test-2f7b6073-261a-49b2-9cce-60b2df379dec';
const plan=()=>primarySplitPlan({ownerId:owner,totalCents:17000,partners:[{receiverId:partner,amountCents:10000}]});
const mockOrder=overrides=>({
 id:'ORDTST01K5HQXYKPDQTS6V0DXQ3ZVSFT',
 external_reference:ref,user_id:owner,currency:'BRL',
 total_amount:'170.00',processing_mode:'automatic',
 status:'processed',status_detail:'accredited',integration_data:{application_id:'777'},
 splits:plan().splits,...overrides
});

test('VELLOR principal recebe 70 e fornecedor consentido recebe 100 de 170',()=>{
 const p=plan();
 assert.equal(p.totalCents,17000);
 assert.equal(p.ownerCents,7000);
 assert.equal(p.supplierCents,10000);
 assert.deepEqual(p.splits.map(x=>[x.receiver_type,x.receiver_id,x.amount]),[
  ['owner',owner,'70.00'],['partner',partner,'100.00']]);
 assert.equal(p.splits.some(x=>x.receiver_type==='marketplace'),false);
});

test('uma order 1:N pix tem owner e partner, nao marketplace_fee ou OAuth do fornecedor',()=>{
 const p=primarySplitPixPayload({plan:plan(),reference:ref,payerEmail:'buyer@testuser.com'});
 assert.equal(p.type,'online');
 assert.equal(p.processing_mode,'automatic');
 assert.equal(p.total_amount,'170.00');
 assert.deepEqual(p.config,{split_rules:{amount_type:'fixed'}});
 assert.equal(p.transactions.payments[0].payment_method.id,'pix');
 assert.equal(p.transactions.payments[0].amount,'170.00');
 assert.equal(p.marketplace_fee,undefined);
 assert.equal(p.application_fee,undefined);
 assert.deepEqual(p.splits.map(x=>x.receiver_type),['owner','partner']);
});

test('rejeita consentimento ausente, duplicado, mais de 10 fornecedores e custo maior que venda',()=>{
 assert.equal(validReceiverId(partner),true);
 assert.equal(validReceiverId(owner),false);
 assert.throws(()=>primarySplitPlan({ownerId:owner,totalCents:17000,partners:[]}));
 assert.throws(()=>primarySplitPlan({ownerId:owner,totalCents:17000,partners:[{receiverId:owner,amountCents:10000}]}));
 assert.throws(()=>primarySplitPlan({ownerId:owner,totalCents:17000,
  partners:[{receiverId:partner,amountCents:10000},{receiverId:partner.toUpperCase(),amountCents:100}]}));
 assert.throws(()=>primarySplitPlan({ownerId:owner,totalCents:17000,
  partners:[{receiverId:partner,amountCents:17001}]}));
 assert.throws(()=>primarySplitPlan({ownerId:owner,totalCents:17000,
  partners:[{receiverId:partner,amountCents:17000}]}));
});

test('consentimento tem que ser ACTIVE e pertencer ao receiver do fornecedor',()=>{
 assert.equal(hasActiveConsent({results:[{receiver_id:partner,status:'ACTIVE'}]},partner),true);
 assert.equal(hasActiveConsent({results:[{receiver_id:partner,status:'PENDING'}]},partner),false);
 assert.equal(hasActiveConsent({results:[{receiver_id:'11111111-1111-4111-8111-111111111111',status:'ACTIVE'}]},partner),false);
 assert.equal(hasActiveConsent({},partner),false);
});

test('audita resposta de pagamento, IDs, splits e credito aprovado',()=>{
 const valid=inspectPrimarySplitOrder(mockOrder(),{plan:plan(),reference:ref,clientId:'777'});
 assert.equal(valid.safe,true);
 assert.equal(valid.approved,true);
 for(const changes of [
  {id:'ORD01K5HQXYKPDQTS6V0DXQ3ZVSFT'},
  {external_reference:'outra'},
  {user_id:'9999'},
  {total_amount:'160.00'},
  {currency:'USD'},
  {integration_data:{application_id:'888'}},
  {splits:[{...plan().splits[0],amount:'80.00'},plan().splits[1]]},
  {splits:[plan().splits[0],{...plan().splits[1],receiver_id:'12345678-1234-4123-8123-123456789012'}]},
  {splits:[plan().splits[0]]}
 ]) {
  assert.equal(inspectPrimarySplitOrder(mockOrder(changes),{plan:plan(),reference:ref,clientId:'777'}).safe,false,
   JSON.stringify(changes));
 }
 const pending=inspectPrimarySplitOrder(mockOrder({status:'processing',status_detail:'pending'}),{plan:plan(),reference:ref,clientId:'777'});
 assert.equal(pending.safe,true);
 assert.equal(pending.approved,false);
});

test('1:N fica fechado sem habilitacao e em ambientes reais',()=>{
 const env={MP_MODE:'sandbox',MP_LIVE_ENABLED:'false',MP_PRIMARY_1N_ENABLED:'true',
  MP_PRIMARY_1N_APPROVED:'true',MP_TEST_ACCESS_TOKEN:'TEST-abc',
  MP_PRIMARY_TEST_SELLER_USER_ID:owner,MP_SECONDARY_TEST_RECEIVER_ID:partner,
  MP_SANDBOX_TEST_CUSTOMER_EMAIL:'buyer@testuser.com'};
 assert.equal(primarySplitSandboxReady(env),true);
 for(const mod of [{MP_MODE:'production'},{MP_LIVE_ENABLED:'true'},{MP_PRIMARY_1N_ENABLED:'false'},
  {MP_PRIMARY_1N_APPROVED:'false'},{MP_TEST_ACCESS_TOKEN:''},
  {MP_SECONDARY_TEST_RECEIVER_ID:''},{MP_PRIMARY_TEST_SELLER_USER_ID:''},
  {MP_SANDBOX_TEST_CUSTOMER_EMAIL:''}])
  assert.equal(primarySplitSandboxReady({...env,...mod}),false,JSON.stringify(mod));
});

test('canario so usa token principal, sandbox e consentimento ACTIVE; nao toca bancos nem checkout comercial',()=>{
 const source=readFileSync(new URL('../app/api/admin/mp-primary-1n-canary/route.js',import.meta.url),'utf8');
 assert.match(source,/requireRole\(req,\['super_admin'\]\)/);
 assert.match(source,/process\.env\.MP_MODE==='sandbox'/);
 assert.match(source,/process\.env\.MP_LIVE_ENABLED!=='true'/);
 assert.match(source,/process\.env\.MP_TEST_ACCESS_TOKEN/);
 assert.match(source,/await oauthSellerId\(token\)/);
 assert.match(source,/x-test-token/);
 assert.match(source,/hasActiveConsent\(consent/);
 assert.match(source,/primarySplitPixPayload/);
 assert.match(source,/mpRequest\('\/v1\/orders'/);
 assert.match(source,/inspectPrimarySplitOrder/);
 assert.equal(source.includes('supplierAccessToken('),false);
 assert.equal(source.includes('marketplace_fee:'),false);
 assert.equal(source.includes('INSERT INTO'),false);
 assert.equal(source.includes('UPDATE orders'),false);
 assert.equal(source.includes('reconcilePayment('),false);
});
