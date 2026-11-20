import test from 'node:test';import assert from 'node:assert/strict';
import {supplierCommission,reserveSummary,distributeDiscount} from '../lib/marketplace-rules.mjs';
test('markup 70% é referência, não bloqueio: administra livremente o preço',()=>{
 assert.equal(supplierCommission(17000,10000),7000);
 assert.equal(supplierCommission(13000,10000),3000);
 assert.equal(supplierCommission(9000,10000),-1000);
});
test('reserva 20% do resultado positivo e uso em prejuízo',()=>{
 assert.deepEqual(reserveSummary({approvedFees:700000,expenses:100000,losses:20000}),{
  commission_cents:700000,operating_profit_cents:580000,reserve_contribution_cents:120000,reserve_balance_cents:100000,available_cents:480000,reserve_deficit_cents:0
 });
 assert.equal(reserveSummary({approvedFees:10000,expenses:15000}).reserve_contribution_cents,0);
});
test('carrinho multiforncedor divide descontos sem perder centavos',()=>{
 const groups=distributeDiscount([{subtotal:33000},{subtotal:12000}],1001);
 assert.equal(groups.reduce((n,g)=>n+g.total,0),43999);
 assert.equal(groups.reduce((n,g)=>n+g.discount,0),1001);
});
test('alerta de postagem respeita dias úteis e não alerta itens postados',async()=>{
 const {isPostingLate,addBusinessDays}=await import('../lib/delivery-rules.mjs');
 assert.equal(addBusinessDays('2026-11-20T12:00:00Z',2).toISOString().slice(0,10),'2026-11-24');
 assert.equal(isPostingLate('2026-11-20T12:00:00Z',2,null,'2026-11-25T12:00:00Z'),true);
 assert.equal(isPostingLate('2026-11-20T12:00:00Z',2,'2026-11-23T12:00:00Z','2026-11-26T12:00:00Z'),false);
});
