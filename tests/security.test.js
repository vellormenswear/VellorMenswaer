import test from 'node:test';import assert from 'node:assert/strict';import {passwordHash,passwordVerify,secureCompare} from '../lib/security.js';
test('senha segura e comparação',async()=>{const a=await passwordHash('EXEMPLO-senha-forte-2026');assert.equal(await passwordVerify('EXEMPLO-senha-forte-2026',a),true);assert.equal(await passwordVerify('senha errada',a),false);await assert.rejects(()=>passwordHash('123'))});

test('comparacao de tokens autenticados constante',()=>{assert.equal(secureCompare('abcdefgh','abcdefgh'),true);assert.equal(secureCompare('abcdefgh','12345678'),false)});

import fs from 'node:fs';
import {contentSecurityPolicy,PERMISSIONS_POLICY} from '../lib/browser-policy.mjs';
test('CSP bloqueia scripts inline e execução de strings, sem impedir scripts do próprio site',()=>{
 const policy=contentSecurityPolicy('abc123');const script=policy.split('; ').find(x=>x.startsWith('script-src '));
 assert.equal(script,"script-src 'self' 'nonce-abc123'");assert.ok(policy.includes("script-src-attr 'none'")&&policy.includes("object-src 'none'")&&policy.includes("frame-ancestors 'none'"));
 assert.ok(PERMISSIONS_POLICY.includes('camera=()')&&PERMISSIONS_POLICY.includes('microphone=()')&&PERMISSIONS_POLICY.includes('payment=(self)'));
 const middleware=fs.readFileSync('middleware.js','utf8'),layout=fs.readFileSync('app/layout.jsx','utf8');assert.ok(middleware.includes('crypto.randomUUID()')&&middleware.includes("response.headers.set('Content-Security-Policy',policy)"));assert.ok(layout.includes("dynamic='force-dynamic'")&&layout.includes('nonce={nonce}'));
});
test('vitrine não executa handlers HTML inline',()=>{const html=fs.readFileSync('public/vitrine.html','utf8'),js=fs.readFileSync('public/vellor-approved.js','utf8');for(const source of [html,js])assert.doesNotMatch(source,/\\bon(?:click|load|error|change|input|submit)\\s*=/i);assert.ok(js.includes("case 'checkout':goCheckout()")&&js.includes("case 'buy':addProduct(true)")&&js.includes("case 'product':showProduct(el.dataset.slug)"));assert.doesNotThrow(()=>new Function(js));});
