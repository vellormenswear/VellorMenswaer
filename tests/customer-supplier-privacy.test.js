import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');

test('acompanhamento do pagamento identifica etapas sem divulgar lojistas parceiros',()=>{
 const page=read('app/pagamento/grupos/page.jsx');
 assert.match(page,/Pagamento \{index\+1\}/);
 assert.match(page,/CONTINUAR PAGAMENTO/);
 assert.doesNotMatch(page,/g\.business_name|Pagamentos por fornecedor|PAGAR ESTE FORNECEDOR/);
 assert.match(page,/g\.checkout_url/);
 assert.match(page,/g\.tracking_code/);
});

test('API do acompanhamento de compra não retorna o nome do recebedor',()=>{
 const api=read('app/api/marketplace/[action]/route.js');
 const customerEndpoint=api.slice(api.indexOf("if(action==='groups')"),api.indexOf("async function createPreference"));
 assert.doesNotMatch(customerEndpoint,/business_name|JOIN suppliers s/);
 assert.match(customerEndpoint,/g\.customer_id=\$2/);
 assert.match(customerEndpoint,/g\.amount_cents/);
 // Internamente a plataforma preserva OAuth e a comissao de Split.
 assert.match(api,/supplierAccessToken\(group\.supplier_id\)/);
 assert.match(api,/marketplace_fee/);
});

test('vitrine preserva os prazos sem referencia visivel ao fornecedor',()=>{
 const storefront=read('public/vellor-approved.js');
 const html=read('public/vitrine.html');
 assert.doesNotMatch(storefront,/Prazo de entrega informado pelo fornecedor|Prazo cadastrado pelo fornecedor|Prazo aguardando cadastro do fornecedor/);
 assert.doesNotMatch(html,/cadastrado pelo respectivo fornecedor/);
 assert.match(storefront,/delivery_days_min/);
 assert.match(storefront,/delivery_days_max/);
});
