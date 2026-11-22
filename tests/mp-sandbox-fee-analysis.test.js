import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sandboxCheckoutFeeAnalysis} from '../lib/mp-sandbox-fee-analysis.mjs';

test('analise preserva centavos e mostra a parcela antes das taxas do provedor',()=>{
 const d=sandboxCheckoutFeeAnalysis({amountCents:200,marketplaceFeeCents:80,supplierAmountCents:120});
 assert.equal(d.valid,true);
 assert.equal(d.marketplace_fee_percentage,40);
 assert.equal(d.supplier_net_after_provider_fee_cents,null);
 assert.ok(d.risk_flags.includes('LOW_VALUE_SANDBOX_TEST'));
});
test('nao trata limiar informativo como regra oficial do Mercado Pago',()=>{
 const d=sandboxCheckoutFeeAnalysis({amountCents:200,marketplaceFeeCents:80,supplierAmountCents:120});
 assert.doesNotMatch(d.message,/minimo oficial exigido/i);
});
test('valores inconsistentes e parcela nula sao sinalizados, sem checkout automatico',()=>{
 const bad=sandboxCheckoutFeeAnalysis({amountCents:10000,marketplaceFeeCents:9000,supplierAmountCents:2000});
 assert.equal(bad.valid,false);
 assert.ok(bad.risk_flags.includes('SPLIT_AMOUNT_MISMATCH'));
 const zero=sandboxCheckoutFeeAnalysis({amountCents:200,marketplaceFeeCents:200,supplierAmountCents:0});
 assert.equal(zero.valid,false);
 assert.ok(zero.risk_flags.includes('ZERO_SUPPLIER_PORTION'));
});
test('diagnostico financeiro existe apenas em endpoint administrativo sandbox',()=>{
 const route=readFileSync('app/api/admin/payment-diagnostics/route.js','utf8');
 assert.match(route,/financial_preflight:sandboxCheckoutFeeAnalysis/);
 assert.match(route,/requireRole\(req,\['super_admin'\]\)/);
 assert.match(route,/MP_MODE==='sandbox'/);
 assert.match(route,/read_only:true/);
 assert.match(route,/diagnostics_version:3/);
});
