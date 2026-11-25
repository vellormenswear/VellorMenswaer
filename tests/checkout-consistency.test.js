import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateReservedQuote} from '../lib/checkout-consistency.mjs';
import {checkoutRequestHash} from '../lib/checkout-attempt.mjs';
const row={id:'v1',sku:'SKU',name:'Camisa',label:'Preta',sizes:['M','G'],price_cents:10000,supplier_cost_cents:6000,stock:5,stock_mode:'quantity',active:true,supplier_available:true,preparation_days:2,delivery_days_min:5,delivery_days_max:15,supplier_id:'s1'};
const item={variant_id:'v1',sku:'SKU',name:'Camisa',variant:'Preta',size:'M',qty:2,unit_cents:10000,cost_cents:6000,stock_mode:'quantity',preparation_days:2,delivery_days_min:5,delivery_days_max:15};
const groups=[{supplier_id:'s1',items:[item]}];
test('reserva aceita somente cotação compatível com versão bloqueada no banco',()=>{
 assert.equal(validateReservedQuote(groups,[row]),true);
 for(const change of [{price_cents:11000},{supplier_cost_cents:7000},{stock_mode:'availability'},{supplier_available:false},{active:false},{supplier_id:'s2'},{sizes:['G']},{stock:1},{sku:'OTHER'},{delivery_days_max:20}]){
  assert.equal(validateReservedQuote(groups,[{...row,...change}]),false,JSON.stringify(change));
 }
 assert.equal(validateReservedQuote(groups,[]),false);
});
test('reserva agrega quantidades de tamanhos diferentes do mesmo SKU',()=>{
 assert.equal(validateReservedQuote([{supplier_id:'s1',items:[item,{...item,size:'G',qty:3}]}],[row]),true);
 assert.equal(validateReservedQuote([{supplier_id:'s1',items:[item,{...item,size:'G',qty:4}]}],[row]),false);
});
test('valor aceito pelo cliente integra a identificação da tentativa',()=>{
 const x={address_id:'a',items:[{sku:'A',qty:1}],expected_total_cents:10000};
 assert.notEqual(checkoutRequestHash(x),checkoutRequestHash({...x,expected_total_cents:11000}));
});
test('reserva usa bloqueio e validação antes de criar grupos ou contatar provedor',()=>{
 const s=readFileSync('app/api/infinitepay/[action]/route.js','utf8');
 assert.match(s,/FOR UPDATE OF v FOR SHARE OF p,s,su/);
 assert.ok(s.indexOf('validateReservedQuote(list,locked.rows)')<s.indexOf('INSERT INTO supplier_order_groups'));
 assert.match(s,/quote.total_cents===x.expected_total_cents/);
 assert.match(readFileSync('app/finalizar/page.jsx','utf8'),/expected_total_cents:quote.total_cents/);
});
test('conciliação trata mudança de modo de estoque como pendência em vez de tentar débito impossível',()=>{
 const s=readFileSync('lib/infinitepay-reconcile.js','utf8');
 assert.match(s,/v.stock_mode==='quantity'&&Number.isSafeInteger\(v.stock\)\?v.stock:-1/);
 assert.match(s,/REFUND_REVIEW_REQUIRED/);
});
