import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('trilha de produto ate pagamento instrumentada',()=>{
 const shop=readFileSync('public/vellor-approved.js','utf8');
 for(const step of ['product.selected','product.variant','cart.added','cart.quantity','cart.removed','cart.quote.started','checkout.opened'])
  assert.ok(shop.includes(step),step);
 const checkout=readFileSync('app/finalizar/page.jsx','utf8');
 for(const step of ['checkout.opened','checkout.quote.started','checkout.create.started','checkout.create.success','checkout.create.failed'])
  assert.ok(checkout.includes(step),step);
 const api=readFileSync('app/api/infinitepay/[action]/route.js','utf8');
 assert.match(api,/quoteCart\(x.items,x.coupon\)/);
 const webhooks=readFileSync('app/api/webhooks/infinitepay/route.js','utf8');
 assert.match(webhooks,/reconcileInfinitepayBatch/);
});
test('API do cliente impede acesso a eventos arbitrarios e guarda apenas metadados seguros',()=>{
 const api=readFileSync('app/api/checkout-traces/route.js','utf8');
 assert.match(api,/originGuard\(req\)/);
 assert.match(api,/allowed\.has\(data\.stage\)/);
 assert.match(api,/ID de rastreamento invalido/);
 assert.match(api,/browser_unverified/);
 assert.match(api,/body\(req,2000\)/);
 const core=readFileSync('lib/checkout-trace.js','utf8');
 assert.match(core,/safeTraceMessage/);
 assert.match(core,/EMAIL_REMOVIDO/);
 assert.match(core,/CREDENCIAL_REMOVIDA/);
 assert.match(core,/metadataKeys=new Set/);
 assert.match(core,/console\.info\('\[checkout\.trace\]'/);
});
test('historico exige admin e usa SQL seguro sem informacoes bancarias',()=>{
 const api=readFileSync('app/api/admin/checkout-traces/route.js','utf8');
 assert.match(api,/requireRole\(req,\['admin','super_admin'\]\)/);
 assert.match(api,/interval '30 days'/);
 assert.match(api,/ORDER BY id DESC LIMIT 300/);
 assert.match(api,/X-Robots-Tag/);
 const core=readFileSync('lib/checkout-trace.js','utf8');
 assert.match(core,/pg_advisory_xact_lock/);
 assert.match(core,/INSERT INTO checkout_trace_events/);
 assert.doesNotMatch(core,/transaction_amount.*payer_email/);
});
test('botao para logs aparece na administracao',()=>{
 const admin=readFileSync('app/admin/page.jsx','utf8');
 assert.match(admin,/Logs de compra/i);
 const page=readFileSync('app/admin/checkout-logs/page.jsx','utf8');
 assert.match(page,/VER TODA A TENTATIVA/);
});
