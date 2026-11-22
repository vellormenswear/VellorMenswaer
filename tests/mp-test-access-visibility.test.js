import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('app/admin/mp-teste/page.jsx','utf8');
test('os dois botoes sempre aparecem no painel, mesmo antes de autenticar',()=>{
 assert.match(src,/GERAR TESTE SIMPLES \(SEM SPLIT\)/);
 assert.match(src,/GERAR TESTE COM SPLIT \(R\$ 1\)/);
 const card=src.indexOf('<h2>Comparar Checkout Pro</h2>');
 const gated=src.indexOf('{authorized&&<>');
 assert.ok(card>=0&&gated>card,'o formulario de teste deve ficar fora do bloco condicional');
});
test('o teste aceita apenas as sessoes admin e superadmin',()=>{
 assert.match(src,/const authorized=user\?\.role==='super_admin'\|\|user\?\.role==='admin'/);
 assert.match(src,/disabled=\{loading\|\|!authorized\|\|!!busy\}/);
 assert.match(src,/if\(!authorized\)/);
 assert.match(src,/ENTRAR \/ TROCAR DE CONTA/);
});
test('a API continua restrita a admin e super_admin no sandbox',()=>{
 const api=readFileSync('app/api/admin/mp-isolated-test/route.js','utf8');
 assert.match(api,/requireRole\(req,\['super_admin','admin'\]\)/);
 assert.match(api,/MP_MODE==='sandbox'/);
});
