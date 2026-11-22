import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toCents,preferenceIntegrity,paymentIntegrity,paymentCandidates} from '../lib/mp-payment-recovery.mjs';
const group={id:'2d21a1b2-940e-4706-97d5-ef00ae47bcc7',preference_id:'3854288750-abc',
 provider_user_id:'3854288750',amount_cents:53970,marketplace_fee_cents:41970};
const pref={id:group.preference_id,collector_id:group.provider_user_id,external_reference:group.id,
 items:[{quantity:3,unit_price:179.90,currency_id:'BRL'}],marketplace_fee:419.70};
const payment={id:123456789,collector_id:group.provider_user_id,external_reference:group.id,
 transaction_amount:539.70,currency_id:'BRL',marketplace_fee:419.70,live_mode:false,status:'approved'};
test('preference integrity never tolerates collector, value, commission or currency mismatch',()=>{
 assert.equal(preferenceIntegrity(pref,group),null);
 assert.equal(preferenceIntegrity({...pref,collector_id:'999'},group),'PREFERENCE_COLLECTOR_MISMATCH');
 assert.equal(preferenceIntegrity({...pref,items:[{quantity:3,unit_price:10}]},group),'PREFERENCE_AMOUNT_MISMATCH');
 assert.equal(preferenceIntegrity({...pref,marketplace_fee:0},group),'PREFERENCE_FEE_MISMATCH');
 assert.equal(preferenceIntegrity({...pref,external_reference:'wrong'},group),'PREFERENCE_REFERENCE_MISMATCH');
 assert.equal(preferenceIntegrity({...pref,items:[{quantity:3,unit_price:179.90,currency_id:'USD'}]},group),'PREFERENCE_AMOUNT_MISMATCH');
});
test('payment must match test environment and actual group, never client values',()=>{
 assert.equal(paymentIntegrity(payment,group,false),null);
 assert.equal(paymentIntegrity({...payment,live_mode:true},group,false),'PAYMENT_ENVIRONMENT_MISMATCH');
 assert.equal(paymentIntegrity({...payment,collector_id:'999'},group,false),'PAYMENT_COLLECTOR_MISMATCH');
 assert.equal(paymentIntegrity({...payment,external_reference:'hijacked'},group,false),'PAYMENT_REFERENCE_MISMATCH');
 assert.equal(paymentIntegrity({...payment,marketplace_fee:1},group,false),'PAYMENT_FEE_MISMATCH');
 assert.equal(paymentIntegrity({...payment,transaction_amount:539},group,false),'PAYMENT_AMOUNT_MISMATCH');
});
test('candidates only from same exact group and preference, unique and bounded',()=>{
 const result=paymentCandidates({group,limit:5,
  payments:{results:[{id:11111,external_reference:group.id},{id:22222,external_reference:'other'}]},
  merchantOrders:{elements:[
   {preference_id:group.preference_id,payments:[{id:33333},{id:11111}]},
   {preference_id:'another',payments:[{id:44444}]}
  ]}});
 assert.deepEqual(result,['11111','33333']);
 assert.equal(toCents(539.7),53970);
});
test('provider recheck route requires ownership, origin guard and server-side reconciliation',()=>{
 const api=readFileSync('app/api/marketplace/[action]/route.js','utf8');
 assert.match(api,/if\(action==='recheck-payment'\)/);
 assert.match(api,/originGuard\(req\)/);
 assert.match(api,/g\.customer_id=\$2/);
 assert.match(api,/recheckProviderPayment\(group\)/);
 const service=readFileSync('lib/mp-payment-recovery.js','utf8');
 assert.match(service,/preferenceIntegrity\(pref,group\)/);
 assert.match(service,/paymentIntegrity\(p,group,process\.env\.MP_MODE==='production'\)/);
 assert.match(service,/reconcilePayment\(providerPayment,String\(group\.provider_user_id\)\)/);
 assert.match(service,/interval '25 seconds'/);
 const ui=readFileSync('app/pagamento/grupos/page.jsx','utf8');
 assert.match(ui,/VERIFICAR STATUS NO MERCADO PAGO/);
});
test('webhook trusts provider live_mode, not missing field on notification body',()=>{
 const hook=readFileSync('app/api/webhooks/mercadopago/route.js','utf8');
 assert.match(hook,/typeof body\.live_mode==='boolean'/);
 assert.match(hook,/ensure\(payment\.live_mode===live/);
});
