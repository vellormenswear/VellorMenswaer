import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file = new URL('../app/admin/fornecedores/page.jsx', import.meta.url);
const source = readFileSync(file, 'utf8');

test('painel do fornecedor declara todas as funções setState utilizadas', () => {
  const declared = new Set([...source.matchAll(/\[\s*\w+\s*,\s*(set[A-Z]\w*)\s*\]\s*=\s*useState\(/g)].map(m => m[1]));
  const called = new Set([...source.matchAll(/\b(set[A-Z]\w*)\s*\(/g)].map(m => m[1]));
  assert.deepEqual([...called].filter(name => !declared.has(name)), [], 'Hooks ausentes: erro de referência no painel');
});

test('operações de pedidos não duplicadas e remessas carregadas com fallback seguro',()=>{const orders=readFileSync(new URL('../app/admin/page.jsx',import.meta.url),'utf8');const route=readFileSync(new URL('../app/api/admin/[resource]/route.js',import.meta.url),'utf8');for(const state of ['setOverdue','setCancellations','setShipped'])assert.ok(!source.includes(state));assert.ok(orders.includes('(order.supplier_groups||[]).length'));assert.ok(orders.includes('order.supplier_groups.map'));assert.ok(route.includes("supplier_groups:['admin','super_admin'].includes(u.role)?"));assert.ok(orders.includes("supplierOrderAction('admin-delivered'"));assert.ok(orders.includes("supplierOrderAction('admin-refund-retry'"));});

const pendingSource=readFileSync(new URL('../components/PendingProducts.jsx',import.meta.url),'utf8');
test('pendências declaram todos os setters e inicializam solicitações como array',()=>{
 const declared=new Set([...pendingSource.matchAll(/\[\s*\w+\s*,\s*(set[A-Z]\w*)\s*\]\s*=\s*useState\(/g)].map(m=>m[1]));
 const called=new Set([...pendingSource.matchAll(/\b(set[A-Z]\w*)\s*\(/g)].map(m=>m[1]));
 assert.deepEqual([...called].filter(name=>!declared.has(name)),[]);
 assert.ok(pendingSource.includes('[changes,setChanges]=useState([])'));
});
