import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=process.cwd();
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const storefront=read('public/vellor-approved.js');
const source=storefront.slice(storefront.indexOf('async function goCheckout(){'),storefront.indexOf('function applyCoupon(){'));
assert.ok(source.startsWith('async function goCheckout()'));

async function attempt(user,fetchOk=true){
 let destination='',stored=0;
 const button={disabled:false,setAttribute(){},removeAttribute(){}};
 const context={cart:[{sku:'ITEM-1',qty:1}],save(){stored++},document:{getElementById(){return button}},window:{location:{assign(v){destination=v}}},fetch:async()=>({ok:fetchOk,json:async()=>({user})})};
 vm.runInNewContext(source,context);
 await vm.runInNewContext('goCheckout()',context);
 return {destination,stored,button};
}

test('checkout envia visitante sem login para cadastro/login mantendo o carrinho',async()=>{
 const result=await attempt(null);
 assert.equal(result.destination,'/conta?next=%2Ffinalizar');
 assert.equal(result.stored,1);
 assert.equal(result.button.disabled,false);
});
test('checkout envia cliente já autenticado diretamente para finalizar',async()=>{
 assert.equal((await attempt({role:'customer'})).destination,'/finalizar');
});
test('falha na verificação envia primeiro ao login, nunca ao checkout',async()=>{
 assert.equal((await attempt(null,false)).destination,'/conta?next=%2Ffinalizar');
 assert.ok(read('app/finalizar/page.jsx').includes("window.location.replace('/conta?next=%2Ffinalizar')"));
 assert.ok(read('app/api/asaas/[action]/route.js').includes('await requireUser(req)'));
});
test('comprar agora verifica sessão; adicionar ao carrinho não exige login',()=>{
 assert.match(storefront,/openCart\(\);if\(buy\)goCheckout\(\)/);
});
test('login e registro retomam checkout após sessão criada, com destino fixo interno',()=>{
 const account=read('app/conta/page.jsx');
 assert.ok(account.includes("get('next')==='/finalizar'"));
 assert.ok(account.includes("window.location.replace('/finalizar')"));
 assert.ok(account.includes("if(['register','login'].includes(a))"));
});
test('Inter carrega com fonte variável sem alterar tamanhos CSS da última versão',()=>{
 const styles=[read('public/vellor-approved.css'),read('app/globals.css')];
 for(const css of styles){assert.ok(css.includes('fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'));assert.ok(css.includes('font-optical-sizing:auto'));}
 assert.ok(read('public/vitrine.html').includes('fonts.gstatic.com'));
});
