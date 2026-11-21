import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {logoutAndRedirect} from '../lib/logout-client.mjs';

test('o botão Sair funciona em páginas sem callback local de logout',()=>{
 const frame=readFileSync('components/Frame.jsx','utf8');
 const supplier=readFileSync('app/fornecedor/page.jsx','utf8');
 const adminSuppliers=readFileSync('app/admin/fornecedores/page.jsx','utf8');
 assert.match(supplier,/<Frame user=\{user\}>/);
 assert.match(adminSuppliers,/<Frame user=\{user\}>/);
 assert.match(frame,/onClick=\{handleSignOut\}/);
 assert.match(frame,/typeof logout==='function'/);
 assert.match(frame,/logoutAndRedirect\(fetch/);
});

test('logout revoga sessão no servidor antes de redirecionar ao login',async()=>{
 let target='',called=false;
 await logoutAndRedirect(async(url,options)=>{
  called=true;
  assert.equal(url,'/api/auth/logout');
  assert.equal(options.method,'POST');
  assert.equal(options.credentials,'same-origin');
  assert.equal(options.body,'{}');
  return {ok:true};
 },url=>{assert.ok(called);target=url});
 assert.equal(target,'/conta');
 const backend=readFileSync('app/api/auth/[action]/route.js','utf8');
 const sessions=readFileSync('lib/auth.js','utf8');
 assert.match(backend,/action==='logout'/);
 assert.match(backend,/await revoke\(req,res\)/);
 assert.match(sessions,/DELETE FROM sessions WHERE token_hash=\$1/);
 assert.match(sessions,/res\.cookies\.set\(COOKIE,''/);
});

test('erro ao encerrar sessão não simula logout nem redireciona',async()=>{
 let redirected=false;
 await assert.rejects(logoutAndRedirect(async()=>({ok:false,json:async()=>({error:'Servidor indisponível'})}),()=>{redirected=true}),/Servidor indisponível/);
 assert.equal(redirected,false);
});
