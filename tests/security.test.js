import test from 'node:test';import assert from 'node:assert/strict';import {passwordHash,passwordVerify,secureCompare,needsPasswordUpgrade,validPassword} from '../lib/security.js';
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
test('vitrine não executa handlers HTML inline',()=>{const html=fs.readFileSync('public/vitrine.html','utf8'),js=fs.readFileSync('public/vellor-approved.js','utf8');for(const source of [html,js])assert.doesNotMatch(source,/\bon(?:click|load|error|change|input|submit)\s*=/i);assert.ok(js.includes("case 'checkout':goCheckout()")&&js.includes("case 'buy':addProduct(true)")&&js.includes("case 'product':showProduct(el.dataset.slug)"));assert.doesNotThrow(()=>new Function(js));});

test('hashes mais fortes preservam senhas legadas e rejeitam parâmetros inválidos',async()=>{
 const {scryptSync}=await import('node:crypto');const pw='EXEMPLO-legacy-2026',salt='a'.repeat(32),old='scrypt$16384$8$1$'+salt+'$'+scryptSync(pw,salt,64,{N:16384,r:8,p:1}).toString('hex');
 assert.ok(needsPasswordUpgrade(old));assert.equal(await passwordVerify(pw,old),true);const updated=await passwordHash(pw);assert.ok(updated.startsWith('scrypt$32768$8$3$'));assert.ok(!needsPasswordUpgrade(updated));assert.equal(await passwordVerify(pw,updated),true);assert.equal(await passwordVerify(pw,'scrypt$16384$8$1$'+salt+'$'),false);assert.equal(validPassword('a'.repeat(129)),false);
});
test('limites atômicos, recuperação de uso único e sessões administrativas curtas',()=>{
 const limit=fs.readFileSync('lib/rate-limit.js','utf8'),auth=fs.readFileSync('app/api/auth/[action]/route.js','utf8'),session=fs.readFileSync('lib/auth.js','utf8');
 assert.ok(limit.includes('ON CONFLICT(key_hash) DO UPDATE')&&limit.includes('HttpError(429'));
 for(const scope of ['login-ip','login-pair','login-account','forgot-ip','forgot-account','reset-ip','register-ip','password-user'])assert.ok(auth.includes(scope),scope);
 assert.ok(auth.includes('DUMMY_PASSWORD_HASH')&&auth.includes('needsPasswordUpgrade')&&auth.includes('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL'));
 assert.ok(session.includes("interval '12 hours'")&&session.includes('password_hash=$4')&&session.includes('httpOnly:true'));
 assert.ok(fs.readFileSync('lib/http.js','utf8').includes('reader.cancel()'));
});

test('mudanças de função revogam sessões e webhooks têm corpo limitado',()=>{const admin=fs.readFileSync('app/api/admin/[resource]/route.js','utf8'),session=fs.readFileSync('lib/auth.js','utf8');assert.ok(admin.includes('8033334')&&admin.includes("await c.query('DELETE FROM sessions WHERE user_id=$1'"));assert.ok(session.includes("s.created_at>now()-interval '12 hours'")&&session.includes('FOR UPDATE'));for(const p of ['infinitepay','asaas'])assert.ok(fs.readFileSync('app/api/webhooks/'+p+'/route.js','utf8').includes('readLimitedText(req,50000)'));});
