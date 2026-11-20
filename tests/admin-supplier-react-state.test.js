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

test('quatro listas do painel começam com valores seguros e não indefinidos', () => {
  for (const [key, setter] of [
    ['changes', 'setChanges'], ['overdue', 'setOverdue'],
    ['cancellations', 'setCancellations'], ['shipped', 'setShipped'],
  ]) {
    assert.ok(source.includes(`[${key},${setter}]=useState([])`), `${key} deve inicializar como array`);
  }
});
