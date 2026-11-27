import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('app/admin/page.jsx','utf8');
const suppliers=readFileSync('app/admin/fornecedores/page.jsx','utf8');
const pending=readFileSync('components/PendingProducts.jsx','utf8');
test('atalhos exclusivamente na visão geral e revisão restrita aos administradores',()=>{
 assert.ok(page.includes("{adm&&tab==='dashboard'&&<nav className=\"app-quicklinks\""));
 assert.ok(page.includes("['approved','Aprovados'],['pending','Pendentes']"));
 assert.ok(page.includes("adm&&productView==='pending'?"));
 assert.ok(page.includes("<PendingProducts refreshToken={pendingRefresh} onChanged={()=>load('products')}/>"));
});
test('revisão, preços e vínculos transferidos integralmente; operações administrativas preservadas',()=>{
 for(const action of ['admin-review','admin-price-review','admin-assign-legacy','admin-legacy','admin-price-requests']){assert.ok(pending.includes(action));assert.ok(!suppliers.includes(action));}
 for(const action of ['admin-create','admin-invite','admin-suspend','admin-refund-retry','admin-delivered'])assert.ok(suppliers.includes(action));
 assert.ok(pending.includes("data.queue.filter(s=>s.status==='pending').map"));
 assert.ok(pending.includes('Histórico de análises concluídas'));
 assert.ok(pending.includes('revision:s.revision'));
});
