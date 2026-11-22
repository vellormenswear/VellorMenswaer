import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkoutProLink,validateCheckoutProUrl} from '../lib/mp-checkout-url.mjs';
import {preferenceMatchesGroup} from '../lib/mp-sandbox-link.mjs';

test('Checkout Pro APP_USR usa init_point original com HTTPS valido',()=>{
 const valid='https://www.mercadopago.com.br/checkout/v1/redirect/a?token=test';
 assert.equal(checkoutProLink({init_point:valid,sandbox_init_point:'https://sandbox.mercadopago.com.br/pay'}),valid);
 assert.equal(validateCheckoutProUrl('https://sandbox.mercadopago.com.br/pay'),null);
 assert.equal(validateCheckoutProUrl('http://www.mercadopago.com.br/pay'),null);
 assert.equal(validateCheckoutProUrl('https://www.mercadopago.com.br.evil.test/pay'),null);
 assert.equal(validateCheckoutProUrl('https://admin:pwd@www.mercadopago.com.br/pay'),null);
});
test('preferencia precisa conferir comprador, valor, recebedor e comissao',()=>{
 const g={id:'123-abc',collectorId:'3854288750',amountCents:200,marketplaceFeeCents:100,payerEmail:'buyer@testuser.com'};
 const p={id:g.id,collector_id:g.collectorId,marketplace_fee:1,payer:{email:g.payerEmail},items:[{unit_price:2,quantity:1}]};
 assert.equal(preferenceMatchesGroup(p,g),true);
 assert.equal(preferenceMatchesGroup({...p,collector_id:'999'},g),false);
 assert.equal(preferenceMatchesGroup({...p,marketplace_fee:0},g),false);
});
test('link sandbox legado desativado e sem chamada a API',()=>{
 const route=readFileSync('app/api/marketplace/[action]/route.js','utf8');
 const branch=route.slice(route.indexOf("if(action==='sandbox-link-test')"),route.indexOf("if(action==='retry-preference')"));
 assert.match(branch,/HttpError\(410/);
 assert.match(route,/const url=checkoutProLink\(mp\)/);
 assert.doesNotMatch(branch,/mpRequest/);
 const page=readFileSync('app/pagamento/grupos/page.jsx','utf8');
 assert.doesNotMatch(page,/TESTAR LINK SANDBOX/);
 assert.match(page,/CONTINUAR PAGAMENTO/);
});
