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

test('API Asaas do comprador nao divulga titularidade dos fornecedores',()=>{
 const api=read('app/api/asaas/[action]/route.js');
 const get=api.slice(api.indexOf('export async function GET'),api.indexOf('export async function POST'));
 assert.doesNotMatch(get,/business_name|wallet_id|supplier_id/);
 assert.match(get,/g.customer_id=\$2/);
 assert.match(get,/g.amount_cents/);
});
test('vitrine preserva os prazos sem referencia visivel ao fornecedor',()=>{
 const storefront=read('public/vellor-approved.js');
 const html=read('public/vitrine.html');
 assert.doesNotMatch(storefront,/Prazo de entrega informado pelo fornecedor|Prazo cadastrado pelo fornecedor|Prazo aguardando cadastro do fornecedor/);
 assert.doesNotMatch(html,/cadastrado pelo respectivo fornecedor/);
 assert.match(storefront,/delivery_days_min/);
 assert.match(storefront,/delivery_days_max/);
});
