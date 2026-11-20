import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('status do marketplace só pode ser consultado por administradores',()=>{
  const src=readFileSync('app/api/admin/marketplace-status/route.js','utf8');
  assert.match(src,/await requireRole\(req,\['admin','super_admin'\]\)/);
  assert.match(src,/information_schema\.tables/);
  assert.match(src,/missing_migrations/);
});

test('telas diferenciam erro de carregamento de carregamento em progresso',()=>{
  for(const file of ['app/admin/fornecedores/page.jsx','app/admin/financeiro/page.jsx','app/fornecedor/page.jsx']) {
    const src=readFileSync(file,'utf8');
    assert.match(src,/TENTAR NOVAMENTE/);
    assert.match(src,/setLoading\(false\)/);
  }
});

test('correção anterior da vitrine está preservada',()=>{
  const html=readFileSync('public/vitrine.html','utf8');
  assert.doesNotMatch(html,/COLEÇÃO NACIONAL|ENVIO NACIONAL|FRETE NACIONAL/i);
  assert.match(html,/ELEGÂNCIA MASCULINA/);
});
