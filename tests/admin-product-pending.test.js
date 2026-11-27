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
 for(const action of ['admin-create','admin-invite','admin-suspend'])assert.ok(suppliers.includes(action));
 for(const action of ['admin-refund-retry','admin-delivered']){assert.ok(page.includes(action));assert.ok(!suppliers.includes(action));}
 assert.ok(pending.includes("data.queue.filter(s=>s.status==='pending').map"));
 assert.ok(pending.includes('Histórico de análises concluídas'));
 assert.ok(pending.includes('revision:s.revision'));
});

test('produtos em nova revisão e rejeitados não retornam à lista de aprovados pelo filtro de inativos',()=>{
 const line=page.split('\n').find(l=>l.includes('const approvedProducts='));
 assert.ok(line);
 const source={products:[{id:1,supplier_listing_status:'approved',active:true},{id:2,supplier_listing_status:'pending',active:false,hidden:true},{id:3,supplier_listing_status:'rejected',active:false,hidden:true},{id:4,supplier_listing_status:'inactive',active:false,hidden:true},{id:5,active:true},{id:6,supplier_listing_status:'deleted'}]};
 const approvedProducts=source.products.filter(p=>!['pending','rejected','deleted'].includes(p.supplier_listing_status));
 assert.deepEqual(approvedProducts.map(p=>p.id),[1,4,5]);
 assert.ok(line.includes("!['pending','rejected','deleted'].includes(p.supplier_listing_status)"));
 assert.ok(page.includes('visibleApprovedProducts=approvedProducts.filter'));
 assert.ok(page.includes('visibleApprovedProducts.map'));
});
