import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkoutReady,checkoutAllowedForUser} from '../lib/supplier-checkout.mjs';
const base={MP_MODE:'sandbox',MP_SPLIT_ENABLED:'true',STORE_OPEN_FOR_ORDERS:'true',DATABASE_URL:'db',MP_CLIENT_ID:'id',MP_CLIENT_SECRET:'secret',MP_TOKEN_ENCRYPTION_KEY:'key',MP_WEBHOOK_SECRET:'hook',SITE_URL:'https://vellormenswear.vercel.app',MP_SANDBOX_TEST_CUSTOMER_EMAIL:'buyer@testuser.com'};
test('checkout em sandbox fechado para visitantes e clientes normais',()=>{
 assert.equal(checkoutReady(base),true);
 assert.equal(checkoutAllowedForUser(base,null),false);
 assert.equal(checkoutAllowedForUser(base,{role:'customer',email:'outro@example.com'}),false);
 assert.equal(checkoutAllowedForUser(base,{role:'supplier',email:'buyer@testuser.com'}),false);
 assert.equal(checkoutAllowedForUser({...base,MP_SANDBOX_TEST_CUSTOMER_EMAIL:''},{role:'customer',email:'buyer@testuser.com'}),false);
 assert.equal(checkoutAllowedForUser({...base,STORE_OPEN_FOR_ORDERS:'false'},{role:'customer',email:'buyer@testuser.com'}),false);
});
test('comprador de teste autorizado pode finalizar apenas em ambiente preparado',()=>{
 assert.equal(checkoutAllowedForUser(base,{role:'customer',email:'BUYER@testuser.com'}),true);
 assert.equal(checkoutAllowedForUser({...base,MP_MODE:'production'},{role:'customer',email:'buyer@testuser.com'}),false);
});
test('endpoint público e endpoints de compra aplicam limite ao cliente sandbox',()=>{
 const status=readFileSync('app/api/store/status/route.js','utf8');
 const route=readFileSync('app/api/marketplace/[action]/route.js','utf8');
 assert.match(status,/checkoutAllowedForUser\(process\.env,u\)/);
 assert.ok((route.match(/checkoutAllowedForUser\(process\.env,u\)/g)||[]).length>=2);
 assert.match(route,/const url=process\.env\.MP_MODE==='sandbox'\?mp\.sandbox_init_point:mp\.init_point;/);
 assert.ok(!route.includes('||mp.init_point'));
});
