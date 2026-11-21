import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mpApiErrorSummary} from '../lib/mp-api-errors.mjs';

test('diagnostico preserva codigos do Mercado Pago e x-request-id',()=>{
 const x=mpApiErrorSummary(400,{error:'invalid_marketplace_fee',
   cause:[{code:2050},{code:'invalid_parameter'}]},'9f3f4be0-037b-4b73-8151-29a0dccbb10b');
 assert.equal(x.http_status,400);
 assert.equal(x.code,'invalid_marketplace_fee');
 assert.deepEqual(x.cause_codes,['2050','invalid_parameter']);
 assert.equal(x.request_id,'9f3f4be0-037b-4b73-8151-29a0dccbb10b');
});

test('diagnostico omite tokens, CPF, mensagens e detalhes do comprador',()=>{
 const p={error:'APP_USR-SECRET-PASTE-HERE',message:'payer name test@test.com CPF 11122233344',
  cause:[{code:'Bearer_SECRET'},{code:'1234'}, {code:'test@test.com'}],
  payer:{email:'test@test.com'},card:{number:'4111111111111111'}};
 const x=mpApiErrorSummary(401,p,'token with spaces or newlines');
 assert.equal(x.code,null);
 assert.equal(x.request_id,null);
 assert.deepEqual(x.cause_codes,['1234']);
 const serialized=JSON.stringify(x);
 assert.equal(serialized.includes('test@test.com'),false);
 assert.equal(serialized.includes('11122233344'),false);
 assert.equal(serialized.includes('4111111111111111'),false);
});

test('API usa authorization header e nunca registra corpo, segredo ou cartao',()=>{
 const marketplace=readFileSync('lib/marketplace.js','utf8');
 assert.match(marketplace,/'Authorization':`Bearer \$\{accessToken\}`/);
 assert.match(marketplace,/mpApiErrorSummary/);
 assert.match(marketplace,/\[mp\.api\.failure\]/);
 assert.match(marketplace,/\.pathname/);
 assert.ok(!marketplace.includes('JSON.stringify(payload)'));
 const diag=readFileSync('app/api/admin/payment-diagnostics/route.js','utf8');
 assert.match(diag,/requireRole\(req,\['super_admin'\]\)/);
 assert.match(diag,/read_only:true/);
});
