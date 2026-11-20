import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const admin=read('app/admin/fornecedores/page.jsx');
const route=read('app/api/suppliers/[action]/route.js');
const accept=read('app/api/supplier-invite/[action]/route.js');
const signup=read('app/fornecedor/cadastro/page.jsx');
const storefront=read('public/vellor-approved.js');
const checkout=read('app/finalizar/page.jsx');

test('painel gera convite sem pedir endereço de e-mail e disponibiliza link copiável',()=>{
 assert.ok(admin.includes("post('admin-invite',{})"));
 assert.ok(admin.includes('GERAR LINK DE CONVITE'));
 assert.ok(admin.includes('COPIAR LINK'));
 assert.ok(admin.includes('navigator.clipboard.writeText(link)'));
 assert.ok(!admin.includes('E-mail do fornecedor'));
});
test('convite guarda token hash, expira em sete dias e não dispara envio de e-mail',()=>{
 assert.ok(route.includes('const token=randomToken()'));
 assert.ok(route.includes("['',sha256(token),u.id]"));
 assert.ok(route.includes("now()+interval '7 days'"));
 assert.ok(!route.includes('sendMail('));
 assert.ok(route.includes('invite_path:invitePath'));
});
test('cadastro coleta e-mail do próprio fornecedor no link sem e-mail prévio',()=>{
 assert.ok(signup.includes("['email','E-mail para sua conta']"));
 assert.ok(signup.includes('JSON.stringify({...form,token})'));
 assert.ok(accept.includes('(!inv.email||inv.email===mail)'));
 assert.ok(accept.includes('inv.used_at===null'));
 assert.ok(accept.includes("SET used_at=now()"));
});
test('compra sem autenticação, inclusive em erro de sessão, inicia no login/cadastro',()=>{
 assert.ok(storefront.includes("window.location.assign('/conta?next=%2Ffinalizar')"));
 assert.ok(checkout.includes("if(!authResponse.ok){window.location.replace('/conta?next=%2Ffinalizar');return;}"));
 assert.ok(checkout.includes('sessionVerified=true'));
 assert.ok(checkout.includes('!loading&&user&&!ordersOpen'));
});
