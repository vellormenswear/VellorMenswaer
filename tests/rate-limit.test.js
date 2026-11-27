import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trustedSource,rateBuckets,consumeRate,RATE_SQL} from '../lib/rate-limit-core.mjs';
test('origem usa somente cabeçalho da Vercel válido e não confia em X-Forwarded-For arbitrário',()=>{
 const h=new Headers({'x-forwarded-for':'192.0.2.1','x-vercel-forwarded-for':'192.0.2.2'});
 assert.equal(trustedSource(h,true),'192.0.2.2');assert.equal(trustedSource(h,false),null);
 assert.equal(trustedSource(new Headers({'x-forwarded-for':'192.0.2.1'}),true),null);
 assert.equal(trustedSource(new Headers({'x-vercel-forwarded-for':'invalid'}),true),null);
});
test('chaves limitam conta, origem e volume global, sem persistir identificadores em texto',()=>{
 const a=rateBuckets('login','192.0.2.2','EXAMPLE@example.com'),b=rateBuckets('login','192.0.2.3','example@example.com');
 assert.equal(a.length,3);assert.notEqual(a[0].key,b[0].key);assert.equal(a[1].key,b[1].key);assert.equal(a[2].key,b[2].key);
 for(const v of a)assert.match(v.key,/^[a-f0-9]{64}$/);
 assert.equal(rateBuckets('telemetry',null).length,1);
});
test('contador persistente interrompe tentativas excedentes e mantém janela fixa',async()=>{
 const buckets=rateBuckets('login','192.0.2.2','example@example.com');let calls=0;
 assert.equal(await consumeRate(async(q,p)=>{calls++;assert.equal(q,RATE_SQL);return {rowCount:p[1]===90?0:1}},buckets),false);assert.equal(calls,1);
 assert.equal(await consumeRate(async()=>({rowCount:1}),buckets),true);
 assert.match(RATE_SQL,/ON CONFLICT/);assert.match(RATE_SQL,/auth_attempts.failures<\$2/);assert.match(RATE_SQL,/ELSE auth_attempts.updated_at END/);
});
test('limites estão presentes em autenticação, chat, telemetria e cotação',()=>{
 for(const [file,scope] of [['app/api/auth/[action]/route.js','login'],['app/api/auth/[action]/route.js','forgot'],['app/api/support/chat/route.js','support'],['app/api/checkout-traces/route.js','telemetry'],['app/api/checkout/[action]/route.js','quote']])assert.ok(readFileSync(file,'utf8').includes("limitRequest(req,'"+scope+"'"));
});
test('alteração de permissões é serializada e auditada na transação',()=>{
 const s=readFileSync('app/api/admin/[resource]/route.js','utf8').split("if(resource==='staff'){")[1].split("if(resource==='legal-identity')")[0];assert.ok(s.includes('pg_advisory_xact_lock')&&s.includes('FOR UPDATE')&&s.includes('await c.query(\'INSERT INTO audit_logs')&&s.includes('DELETE FROM sessions'));
});
test('CSP efetiva impede scripts inline e mantém nonce individual',()=>{const middleware=readFileSync('middleware.js','utf8'),policy=readFileSync('lib/browser-policy.mjs','utf8');assert.match(middleware,/crypto\.randomUUID\(\)/);assert.match(middleware,/response\.headers\.set\('Content-Security-Policy',policy\)/);assert.match(policy,/script-src-attr 'none'/);assert.match(policy,/nonce-/);assert.doesNotMatch(readFileSync('public/vitrine.html','utf8'),/\bon(?:click|change|load|error)="/);});
