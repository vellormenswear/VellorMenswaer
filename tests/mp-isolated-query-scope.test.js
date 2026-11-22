import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('resultado sem merchant orders nao afirma falsamente ausencia global de pagamentos',()=>{
 const route=readFileSync('app/api/admin/mp-isolated-test/route.js','utf8');
 assert.match(route,/NO_MERCHANT_ORDER_FOUND/);
 assert.doesNotMatch(route,/NO_ORDER_OR_PAYMENT/);
 assert.match(route,/merchant_orders_linked_payments_only/);
 assert.match(route,/independent_payment_search_performed:false/);
 assert.match(route,/Sem busca independente por pagamentos/);
 assert.match(route,/requireRole\(req,\['super_admin','admin'\]\)/);
 assert.match(route,/MP_MODE==='sandbox'/);
});
test('painel explica limite de verificacao',()=>{
 const page=readFileSync('app/admin/mp-teste/page.jsx','utf8');
 assert.match(page,/outcome_explanation/);
});
