import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readJsonObject} from '../lib/request-body.mjs';
const req=s=>new Request('https://example.invalid',{method:'POST',body:s});
test('JSON exige objeto e rejeita entradas inválidas',async()=>{
 assert.deepEqual(await readJsonObject(req('{"ok":true}')),{ok:true});
 for(const input of ['null','[]','1','"abc"','{'])await assert.rejects(readJsonObject(req(input)),{status:400});
});
test('limite de bytes funciona sem content-length e com UTF8',async()=>{
 await assert.rejects(readJsonObject(req('{"x":"é"}'),9),{status:413});
 await assert.rejects(readJsonObject(new Request('https://example.invalid',{method:'POST',headers:{'content-length':'100'},body:'{}'}),10),{status:413});
 assert.deepEqual(await readJsonObject(req('{}'),2),{});
});
test('dados de catálogo não são interpolados em JavaScript inline',()=>{
 const s=readFileSync('public/vellor-approved.js','utf8');
 assert.doesNotMatch(s,/onclick="(?:showProduct|changeVariant|selectGalleryImage)\([^"]*\$\{/);
 for(const key of ['dataset.productSlug','dataset.variantSku','dataset.galleryUrl'])assert.ok(s.includes(key));
});
test('alteração de senha invalida todos os tokens e sessões',()=>{
 const s=readFileSync('app/api/auth/[action]/route.js','utf8');
 assert.equal((s.match(/UPDATE password_reset_tokens SET used_at=now\(\) WHERE user_id=\$1 AND used_at IS NULL/g)||[]).length,2);
 assert.ok(s.includes('AND launch_archived_at IS NULL FOR UPDATE'));
});
test('cotação cancela requisições antigas e valida a versão dos dados',()=>{
 const s=readFileSync('app/finalizar/page.jsx','utf8');
 assert.ok(s.includes('controller.abort()')&&s.includes('quote.requestCoupon===coupon')&&s.includes('quote.requestCart===JSON.stringify(cart)'));
});
