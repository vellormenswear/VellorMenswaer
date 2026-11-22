import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSandboxCheckoutUrl,preferenceMatchesGroup} from '../lib/mp-sandbox-link.mjs';

test('somente URL HTTPS devolvida no dominio sandbox oficial',()=>{
 assert.equal(validateSandboxCheckoutUrl('https://sandbox.mercadopago.com.br/checkout/pay?pref_id=abc'),
  'https://sandbox.mercadopago.com.br/checkout/pay?pref_id=abc');
 assert.equal(validateSandboxCheckoutUrl('https://www.mercadopago.com.br/checkout/start'),null);
 assert.equal(validateSandboxCheckoutUrl('https://sandbox.mercadopago.com.br.evil.test/pay'),null);
 assert.equal(validateSandboxCheckoutUrl('http://sandbox.mercadopago.com.br/pay'),null);
 assert.equal(validateSandboxCheckoutUrl('https://admin:password@sandbox.mercadopago.com.br/pay'),null);
});
test('preferencia so vale para comprador, recebedor, valor e comissao corretos',()=>{
 const g={id:'123-abc',collectorId:'3854288750',amountCents:200,marketplaceFeeCents:100,payerEmail:'buyer@testuser.com'};
 const p={id:g.id,collector_id:g.collectorId,marketplace_fee:1,
 payer:{email:'buyer@testuser.com'},items:[{unit_price:2,quantity:1}]};
 assert.equal(preferenceMatchesGroup(p,g),true);
 assert.equal(preferenceMatchesGroup({...p,marketplace_fee:0},g),false);
 assert.equal(preferenceMatchesGroup({...p,collector_id:'9999'},g),false);
 assert.equal(preferenceMatchesGroup({...p,payer:{email:'someoneelse@testuser.com'}},g),false);
});
test('alternativa sandbox restrita por usuario e ambiente sem afetar checkout normal',()=>{
 const route=readFileSync('app/api/marketplace/[action]/route.js','utf8');
 const section=route.slice(route.indexOf("if(action==='sandbox-link-test')"),route.indexOf("if(action==='retry-preference')"));
 assert.match(section,/MP_MODE==='sandbox'/);
 assert.match(section,/checkoutAllowedForUser\(process\.env,u\)/);
 assert.match(section,/g\.customer_id=\$2/);
 assert.match(section,/validateSandboxCheckoutUrl\(pref\.sandbox_init_point\)/);
 assert.match(section,/preferenceMatchesGroup/);
 assert.match(route,/const url=mp\.init_point;/);
 assert.ok(!section.includes('UPDATE supplier_order_groups'));
 assert.ok(!section.includes('INSERT INTO supplier_order_groups'));
 const page=readFileSync('app/pagamento/grupos/page.jsx','utf8');
 assert.match(page,/TESTAR LINK SANDBOX \(ALTERNATIVO\)/);
 assert.match(page,/sandbox_link_test_enabled/);
});
