import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stockAllowsQuantity} from '../lib/stock-availability.mjs';
import {normalizePgConnectionString} from '../lib/postgres-ssl.mjs';
import {checkoutBlockCode} from '../lib/checkout-block-reasons.mjs';

test('estoque por disponibilidade nao bloqueia itens por stock numerico zero',()=>{
 assert.equal(stockAllowsQuantity('availability',0,1),true);
 assert.equal(stockAllowsQuantity('availability',0,10),true);
});
test('estoque controlado por quantidade continua validado',()=>{
 assert.equal(stockAllowsQuantity('quantity',0,1),false);
 assert.equal(stockAllowsQuantity('quantity',2,3),false);
 assert.equal(stockAllowsQuantity('quantity',2,2),true);
 assert.equal(stockAllowsQuantity('quantity',null,1),true);
});
test('commerce utiliza o modo de estoque da variante',()=>{
 const code=readFileSync('lib/commerce.js','utf8');
 assert.match(code,/v\.stock_mode/);
 assert.match(code,/stockAllowsQuantity\(p\.stock_mode,p\.stock,qty\)/);
});
test('sslmode permanece com verificacao de certificado e hostname',()=>{
 const raw='postgresql://dbuser:pass@server.example.com:5432/neondb?sslmode=require&channel_binding=require';
 const changed=normalizePgConnectionString(raw);
 assert.equal(new URL(changed).searchParams.get('sslmode'),'verify-full');
 assert.equal(new URL(changed).searchParams.get('channel_binding'),'require');
 assert.equal(normalizePgConnectionString('postgres://user:p@host/db?sslmode=verify-full'),'postgres://user:p@host/db?sslmode=verify-full');
 assert.match(readFileSync('lib/db.js','utf8'),/rejectUnauthorized:true/);
});
test('checkout Asaas segue isolado e valida estoque no servidor',()=>{
 const route=readFileSync('app/api/asaas/[action]/route.js','utf8');
 assert.match(route,/Estoque insuficiente/);
 assert.match(route,/asaasReady\(process.env,u\)/);
 const page=readFileSync('app/finalizar/page.jsx','utf8');
 assert.match(page,/setErrorCode/);
});
