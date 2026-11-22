import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safeCreationDiagnostic,safeHost} from '../lib/mp-isolated-test.mjs';
test('nao retorna parametros de URL',()=>{
 assert.equal(safeHost('https://sandbox.mercadopago.com.br/pay?rtk=SECRET'),'sandbox.mercadopago.com.br');
 assert.equal(safeHost('http://sandbox.mercadopago.com.br/pay'),null);
});
test('report apenas campos permitidos',()=>{
 const r=safeCreationDiagnostic({request:{items:[{title:'Teste',unit_price:20,quantity:1,currency_id:'BRL'}],marketplace_fee:1},
 preference:{id:'mp-123',collector_id:'123',items:[{unit_price:20,quantity:1}],marketplace_fee:1,
  init_point:'https://www.mercadopago.com.br/checkout?token=SECRET',
  sandbox_init_point:'https://sandbox.mercadopago.com.br/checkout?token=SECRET',
  access_token:'SECRET',live_mode:false},meta:{http_status:201,request_id:'request-id'},
 sellerId:'123',mode:'split'});
 assert.equal(r.response.id,'mp-123');
 assert.equal(r.response.init_point_host,'www.mercadopago.com.br');
 assert.equal(r.response.sandbox_init_point_host,'sandbox.mercadopago.com.br');
 assert.equal(r.response.item_total_matches,true);
 assert.equal(r.response.collector_matches_test_seller,true);
 assert.equal(r.response.marketplace_fee_matches,true);
 assert.equal(r.response.http_status,201);
 assert.equal(JSON.stringify(r).includes('SECRET'),false);
});
test('pagina exibe retorno e dominio observado com controle de acesso',()=>{
 const page=readFileSync('app/admin/mp-teste/page.jsx','utf8');
 const route=readFileSync('app/api/admin/mp-isolated-test/route.js','utf8');
 assert.match(page,/Dominio que voce viu no navegador/);
 assert.match(page,/COPIAR RELATORIO TECNICO/);
 assert.match(page,/creation_diagnostic/);
 assert.match(route,/safeCreationDiagnostic/);
 assert.match(route,/requireRole\(req,\['super_admin','admin'\]\)/);
 assert.match(route,/MP_MODE==='sandbox'/);
 assert.match(route,/validateSandboxCheckoutUrl\(pref\.sandbox_init_point\)/);
});
