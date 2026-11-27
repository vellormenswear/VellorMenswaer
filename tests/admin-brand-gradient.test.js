import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('admin and supplier tabs reuse the exact neutral storefront brand gradient',()=>{
 const css=read('app/globals.css'),store=read('public/vellor-approved.css'),finance=read('app/admin/financeiro/finance.module.css');
 const gradient=css.match(/--vll-brand-gradient:(linear-gradient\([^}]+\))/)?.[1];
 assert.equal(gradient,'linear-gradient(90deg,#10362c 0%,#242326 50%,#401328 100%)');
 assert.ok(store.includes('linear-gradient(90deg,var(--season-left,#10362c) 0%,var(--season-mid,#242326) 50%,var(--season-right,#401328) 100%)'));
 assert.match(css,/\.vll-admin-app \.sidebar\{background:var\(--vll-brand-gradient\)\}/);
 assert.doesNotMatch(css,/\.vll-admin-app \.sidebar\{background:var\(--green\)\}/);
 assert.match(css,/\.vll-admin-app \.navtabs button\.active,\.vll-admin-page \.navtabs button\.active,\.vll-supplier-app \.navtabs button\.active,\.vll-admin-app \.app-order-filter-chip\.active\{background:var\(--vll-brand-gradient\);border-color:#401328;color:#fff\}/);
 assert.match(finance,/\.tabs button\.active\{background:var\(--vll-brand-gradient\);color:#fff;box-shadow:0 2px 6px #1534260d\}/);
 assert.match(css,/\.vll-account-app \.navtabs button\.active\{color:#174b36;background:white/);
});
