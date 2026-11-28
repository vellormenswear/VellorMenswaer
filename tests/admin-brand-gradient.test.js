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

test('account profile and solid actions use approved gradient without changing secondary or active tab styles',()=>{
 const css=read('app/globals.css'),account=read('app/conta/page.jsx');
 assert.match(css,/\.app-profile\{[^}]*background:var\(--vll-brand-gradient\);color:white\}/);
 assert.match(css,/\.vll-account-app \.navtabs a\{background:var\(--vll-brand-gradient\);color:white\}/);
 assert.match(css,/\.vll-account-app \.btn:not\(\.gold\):not\(\.ghost\):not\(\.danger\)\{background:var\(--vll-brand-gradient\);border-color:#401328;color:#fff\}/);
 assert.match(css,/\.vll-account-app \.navtabs button\.active\{color:#174b36;background:white/);
 assert.match(account,/className="btn" disabled=\{profileBusy\}/);
 assert.match(account,/className="btn" disabled=\{passwordBusy\}/);
 assert.match(account,/className="btn-small" href="\/admin"/);
 assert.match(account,/className="btn-small" href="\/fornecedor"/);
});
test('login, registration and recovery actions use the brand gradient without changing profile tabs',()=>{
 const css=read('app/globals.css'),account=read('app/conta/page.jsx');
 assert.match(css,/\.vll-account-app \.vll-auth-tabs button\.active\{background:var\(--vll-brand-gradient\);color:#fff\}/);
 assert.match(account,/className="navtabs vll-auth-tabs"\>\{\[\['login','Entrar'\]/);
 assert.match(account,/className="btn" type="submit" disabled=\{authBusy\}/);
 assert.match(account,/className="navtabs"\>\{\[\['perfil','Dados pessoais'\]/);
});
test('floating support uses the official gradient on both storefront and account while retaining its circular icon',()=>{
 const css=read('public/vellor-support.css');
 assert.ok(css.includes('background-image:var(--vll-brand-gradient,linear-gradient(90deg,#10362c 0%,#242326 50%,#401328 100%));'));
 assert.ok(css.includes('width:58px!important;height:58px!important'));
 assert.ok(css.includes('width:54px!important;height:54px!important'));
 for(const path of ['components/SupportWidget.jsx','public/vitrine.html'])assert.ok(read(path).includes('/vellor-support.css?v=20261127-gradient'));
});
