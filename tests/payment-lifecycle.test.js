import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paymentRequiresReview} from '../lib/payment-lifecycle.mjs';
const now=Date.parse('2026-11-25T12:00:00Z'),valid={payment_status:'pending',checkout_expires_at:'2026-11-25T13:00:00Z'};
test('pagamento recebido após expiração ou falha local requer análise financeira',()=>{
 assert.equal(paymentRequiresReview('pending',[valid],now),false);
 assert.equal(paymentRequiresReview('creating',[valid],now),false);
 assert.equal(paymentRequiresReview('failed',[valid],now),true);
 for(const g of [{...valid,checkout_expires_at:'2026-11-25T11:00:00Z'},{...valid,checkout_expires_at:null},{...valid,payment_status:'rejected'}])assert.equal(paymentRequiresReview('pending',[g],now),true);
});
test('reconciliação verifica provedor antes de recuperar checkout vencido e impede repasse',()=>{
 const s=readFileSync('lib/infinitepay-reconcile.js','utf8');
 assert.doesNotMatch(s,/if\(batch.status==='failed'\)return/);
 assert.ok(s.indexOf('verifiedInfinitepayPayment(paid')<s.indexOf('paymentRequiresReview(current.status'));
 assert.match(s,/const stockOk=!requiresReview/);
 assert.match(s,/stockOk\?'approved':'refund_pending'/);
 assert.match(s,/stockOk\?'awaiting_payout':'cancel_requested'/);
});
test('webhook limita corpo e volume antes de chamar o provedor',()=>{
 const s=readFileSync('app/api/webhooks/infinitepay/route.js','utf8');
 assert.match(s,/await body\(req,50000\)/);assert.ok(s.indexOf("await limitRequest(req,'paymentWebhook')")<s.indexOf('await reconcileInfinitepayBatch('));
});
test('consulta recupera tentativas ainda sem link e não orienta duplicar pagamento vencido',()=>{
 assert.match(readFileSync('app/api/infinitepay/[action]/route.js','utf8'),/LEFT JOIN infinitepay_checkout_batches b/);
 assert.match(readFileSync('app/pagamento/grupos/page.jsx','utf8'),/Se você já pagou, verifique o pagamento/);
 assert.match(readFileSync('app/admin/infinitepay/page.jsx','utf8'),/www\.vellormenswear\.com\.br/);
});
