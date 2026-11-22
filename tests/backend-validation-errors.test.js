import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('solicitação duplicada de preço retorna conflito em vez de erro 500',()=>{
 const src=readFileSync(new URL('../app/api/suppliers/[action]/route.js',import.meta.url),'utf8');
 assert.match(src,/ON CONFLICT \(variant_id\) WHERE status='pending' DO NOTHING RETURNING id/);
 assert.match(src,/Já existe uma solicitação de alteração de preço pendente para esta variação/);
});
test('cadastro, redefinição e troca validam comprimento da senha antes do hash',()=>{
 const src=readFileSync(new URL('../app/api/auth/[action]/route.js',import.meta.url),'utf8');
 assert.match(src,/pw\.length>=12&&pw\.length<=128/);
 assert.match(src,/x\.password\.length>=12&&x\.password\.length<=128/);
 assert.match(src,/x\.next\.length>=12&&x\.next\.length<=128/);
});
