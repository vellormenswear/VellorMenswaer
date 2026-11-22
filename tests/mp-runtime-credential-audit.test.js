import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mpRuntimeConfigAudit,mpRuntimePreferenceAudit} from '../lib/mp-runtime-credential-audit.mjs';

test('auditoria de configuracao valida relacionamentos sem retornar segredos',()=>{
 const raw={
  MP_MODE:'sandbox',MP_LIVE_ENABLED:'false',MP_SPLIT_ENABLED:'true',STORE_OPEN_FOR_ORDERS:'true',
  SITE_URL:'https://vellormenswear.vercel.app',
  MP_OAUTH_REDIRECT_URI:'https://vellormenswear.vercel.app/api/marketplace/oauth-callback',
  MP_CLIENT_ID:'1234',MP_CLIENT_SECRET:'very-secret',
  MP_SANDBOX_TEST_SELLER_USER_ID:'12345',MP_SANDBOX_TEST_CUSTOMER_EMAIL:'buyer@example.com',
  MP_WEBHOOK_SECRET:'secret',MP_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),DATABASE_URL:'postgres://hidden'
 };
 const output=mpRuntimeConfigAudit(raw);
 assert.ok(Object.values(output).every(v=>v===true));
 assert.equal(JSON.stringify(output).includes('very-secret'),false);
 assert.equal(JSON.stringify(output).includes('postgres://hidden'),false);
});
test('auditoria identifica variaveis inconsistentes',()=>{
 const report=mpRuntimeConfigAudit({MP_MODE:'production',SITE_URL:'http://localhost:3000',MP_OAUTH_REDIRECT_URI:'http://localhost:3000/callback'});
 assert.equal(report.sandbox_mode,false);
 assert.equal(report.site_https_valid,false);
 assert.equal(report.oauth_redirect_matches_site,false);
});
test('auditoria de preferencia detecta vendedor aplicativo e valor divergentes',()=>{
 const pref={id:'pref',collector_id:123,client_id:456,items:[{unit_price:20,quantity:1}],marketplace_fee:1,init_point:'https://www.mercadopago.com.br/checkout/v1/redirect',live_mode:false};
 const expected={sellerId:'123',clientId:'456',amountCents:2000,feeCents:100};
 const good=mpRuntimePreferenceAudit(pref,expected);
 assert.equal(good.seller_matches,true);
 assert.equal(good.application_matches,true);
 assert.equal(good.item_total_matches,true);
 assert.equal(good.fee_matches,true);
 const wrong=mpRuntimePreferenceAudit({...pref,collector_id:999,client_id:777,marketplace_fee:2},expected);
 assert.equal(wrong.seller_matches,false);
 assert.equal(wrong.application_matches,false);
 assert.equal(wrong.fee_matches,false);
 assert.equal(mpRuntimePreferenceAudit({...pref,client_id:null},expected).application_matches,null);
});
test('endpoint de auditoria exige super administrador e nao renova credenciais',()=>{
 const src=readFileSync(new URL('../app/api/admin/mp-runtime-audit/route.js',import.meta.url),'utf8');
 assert.match(src,/requireRole\(req,\['super_admin'\]\)/);
 assert.match(src,/MP_MODE!=='sandbox'/);
 assert.match(src,/decryptSecret\(connection.token_encrypted\)/);
 assert.match(src,/oauthSellerId\(token\)/);
 assert.equal(src.includes('supplierAccessToken('),false);
 assert.equal(src.includes('oauth/token'),false);
 assert.equal(src.includes('INSERT INTO'),false);
 assert.equal(src.includes('UPDATE '),false);
});
