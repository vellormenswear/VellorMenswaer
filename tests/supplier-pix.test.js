import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePixKey,parseSupplierPix,maskPixKey,supplierPixSummary,PIX_TYPES} from '../lib/supplier-pix.mjs';
import {MARKETPLACE_MIGRATIONS} from '../lib/marketplace-schema-sql.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('aceita somente tipos oficiais de chave Pix e normaliza telefone, CPF/CNPJ e e-mail',()=>{
 assert.deepEqual(PIX_TYPES,['cpf','cnpj','email','phone','random']);
 assert.equal(normalizePixKey('cpf','529.982.247-25'),'52998224725');
 assert.equal(normalizePixKey('cnpj','11.222.333/0001-81'),'11222333000181');
 assert.equal(normalizePixKey('phone','(21) 96559-8004'),'+5521965598004');
 assert.equal(normalizePixKey('phone','+55 21 96559-8004'),'+5521965598004');
 assert.equal(normalizePixKey('email',' ExEmPlO@GMAIL.com '),'exemplo@gmail.com');
 assert.equal(normalizePixKey('random','123E4567-E89B-12D3-A456-426614174000'),'123e4567-e89b-12d3-a456-426614174000');
});
test('rejeita dados ausentes e Pix inválido antes de criar conta',()=>{
 for(const [type,key] of [['cpf','11111111111'],['cpf','123'],['cnpj','00000000000000'],['email','x@'],['phone','123456'],['random','1234'],['other','52998224725']]){
  assert.equal(normalizePixKey(type,key),null,type);
 }
 assert.equal(parseSupplierPix({pix_type:'',pix_key:'',pix_holder_name:''}),null);
 assert.equal(parseSupplierPix({pix_type:'email',pix_key:'vendedor@example.com',pix_holder_name:''}),null);
 assert.deepEqual(parseSupplierPix({pix_type:'email',pix_key:'vend@exemplo.com',pix_holder_name:'  João   de Souza '}),{
  pix_type:'email',pix_key:'vend@exemplo.com',holder_name:'João de Souza'
 });
});
test('a chave é mascarada no portal, mas o admin habilitado pode copiá-la para pagar',()=>{
 assert.equal(maskPixKey('cpf','52998224725'),'••••4725');
 assert.equal(maskPixKey('email','vendedor@exemplo.com'),'v••••@exemplo.com');
 assert.equal(supplierPixSummary(null).registered,false);
 const summary=supplierPixSummary({pix_type:'phone',pix_key:'+5521965598004',holder_name:'Fulano'});
 assert.equal(summary.pix_key_mask,'••••8004');
 assert.ok(!JSON.stringify(summary).includes('965598004'));
 const supplier=read('app/api/suppliers/[action]/route.js');
 assert.ok(supplier.includes('supplierPixSummary(pixAccount.rows[0])'));
 assert.ok(supplier.includes("currentSupplier(req)"));
 assert.ok(supplier.includes("AS pix_registered"));
 const admin=read('app/api/admin/infinitepay/route.js');
 assert.ok(admin.includes("requireRole(req,['super_admin'])"));
 assert.ok(admin.includes("CASE WHEN g.fulfillment_status='awaiting_payout' THEN pix.pix_key ELSE NULL END"));
 assert.ok(admin.includes('LEFT JOIN supplier_pix_accounts pix'));
});
test('a criação por convite grava conta e Pix na mesma transação',()=>{
 const page=read('app/fornecedor/cadastro/page.jsx');
 const backend=read('app/api/supplier-invite/[action]/route.js');
 assert.ok(page.includes('id="pix-type"')&&page.includes('id="pix-key"')&&page.includes('id="pix-holder"'));
 assert.ok(page.includes("JSON.stringify({...form,token})"));
 assert.ok(backend.includes('parseSupplierPix(x)'));
 assert.ok(backend.includes("ensure(pix,'Informe uma chave Pix válida"));
 assert.ok(backend.includes('await transaction(async c=>'));
 assert.ok(backend.includes('INSERT INTO supplier_pix_accounts'));
 assert.ok(backend.includes('UPDATE supplier_invites SET used_at=now()'));
});
test('fornecedor antigo pode cadastrar e atualizar sua própria chave Pix com auditoria sem dados sensíveis',()=>{
 const supplier=read('app/api/suppliers/[action]/route.js');
 const page=read('app/fornecedor/page.jsx');
 assert.ok(supplier.includes("if(action==='pix-account')"));
 assert.ok(supplier.includes("const {user,supplier}=await currentSupplier(req)"));
 assert.ok(supplier.includes('ON CONFLICT(supplier_id)'));
 assert.ok(supplier.includes("audit(user.id,'supplier.pix_updated'"));
 assert.ok(supplier.includes("{pix_type:pix.pix_type}"));
 assert.ok(!supplier.includes('audit(user.id,\'supplier.pix_updated\',\'supplier\',supplier.id,null,{pix_key:'));
 assert.ok(page.includes("Minha chave Pix para repasses"));
 assert.ok(page.includes('ATUALIZAR CHAVE PIX'));
 assert.ok(page.includes("pix_key_mask"));
});
test('um repasse manual é bloqueado sem chave cadastrada ou se ela mudou no meio da operação',()=>{
 const backend=read('app/api/admin/infinitepay/route.js'),ui=read('app/admin/infinitepay/page.jsx');
 assert.ok(backend.includes('WHERE supplier_id=$1 FOR SHARE'));
 assert.ok(backend.includes("ensure(pix.rowCount"));
 assert.ok(backend.includes('pix_updated_at'));
 assert.ok(backend.includes('recipient.pix_key.slice(-4)'));
 assert.ok(backend.includes('INSERT INTO supplier_manual_payouts'));
 assert.ok(backend.includes("fulfillment_status='paid'"));
 assert.ok(ui.includes('COPIAR CHAVE PIX'));
 assert.ok(ui.includes('!g.pix_key||!g.pix_updated_at'));
 assert.ok(ui.includes('pix_updated_at:g.pix_updated_at'));
 assert.ok(ui.includes('confirm('));
 assert.ok(!ui.includes("fetch('/api/payments/pix-transfer'"));
});
test('migração é não destrutiva, versionada e acionada por painel autenticado',()=>{
 const sql=read('db/010_supplier_pix.sql');
 assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS supplier_pix_accounts'));
 assert.ok(sql.includes('supplier_id uuid PRIMARY KEY'));
 assert.ok(!/DROP TABLE|TRUNCATE|DELETE FROM/i.test(sql));
 assert.ok(sql.includes('ALTER TABLE supplier_manual_payouts ADD COLUMN IF NOT EXISTS pix_key_suffix'));
 const migration=MARKETPLACE_MIGRATIONS.find(([name])=>name==='010_supplier_pix.sql');
 assert.ok(migration);
 assert.equal(migration[1],sql);
 const status=read('app/api/admin/marketplace-status/route.js');
 assert.ok(status.includes("'010_supplier_pix.sql'"));
 assert.ok(status.includes("'supplier_pix_accounts'"));
 assert.ok(read('app/api/suppliers/[action]/route.js').includes('await applyMarketplaceMigrations(()=>db().connect())'));
});
test('não quebra autenticação, InfinitePay, notificações ou área pública',()=>{
 const signup=read('app/api/supplier-invite/[action]/route.js');
 const payout=read('app/api/admin/infinitepay/route.js');
 assert.ok(signup.includes('issueSession(result.user_id,res'));
 assert.ok(payout.includes("'reconcile_payment'"));
 assert.ok(payout.includes("'supplier_paid'"));
 assert.ok(payout.includes("'supplier.pix_manual_recorded'"));
 assert.ok(!read('public/vitrine.html').includes('supplier_pix_accounts'));
});

test('cadastro manual administrativo cria somente fornecedor, Pix e auditoria na mesma transação',()=>{
 const route=read('app/api/suppliers/[action]/route.js'),page=read('app/admin/fornecedores/page.jsx');
 const start=route.indexOf("if(action==='admin-create')"),end=route.indexOf("if(action==='admin-invite')",start);
 assert.ok(start>route.indexOf("if(action.startsWith('admin-')){const u=await requireRole(req,adminRoles);")&&end>start);
 assert.ok(route.includes("const adminRoles=['admin','super_admin']"));
 const code=route.slice(start,end);
 for(const part of ['parseSupplierPix(x)','ensure(pix','isBrazilianDocument(document)','passwordHash(x.password)','await transaction(async c=>','WHERE lower(email)=$1',"VALUES($1,$2,$3,$4,\'supplier\')",'INSERT INTO suppliers','INSERT INTO supplier_pix_accounts','INSERT INTO audit_logs','supplier.admin_created'])assert.ok(code.includes(part),part);
 assert.ok(code.includes("e.code==='23505'"));
 assert.ok(!code.includes('issueSession')&&!code.includes('UPDATE users'));
 assert.ok(code.includes("JSON.stringify({registration:'manual',pix_type:pix.pix_type})"));
 assert.ok(page.includes("['admin','super_admin'].includes(user?.role)"));
 assert.ok(page.includes("call('POST','suppliers/admin-create',payload)"));
 assert.ok(page.includes('manual.password!==manual.password_confirmation'));
 assert.ok(page.includes('setManual(emptyManual)'));
 assert.ok(page.includes("post('admin-invite',{})"));
});

test('cidade fornecida é preservada individualmente e chave existente não precisa ser redigitada',()=>{const p=parseSupplierPix({pix_type:'email',pix_key:'vendedor@example.com',pix_holder_name:'Nome de Teste',pix_city:'São Paulo'});assert.equal(p.pix_city,'São Paulo');assert.equal(supplierPixSummary(p).pix_city,'São Paulo');assert.equal(parseSupplierPix({...p,pix_holder_name:p.holder_name,pix_city:'123'}),null);const api=read('app/api/suppliers/[action]/route.js');assert.match(api,/rawKey\|\|current\?\.pix_key/);assert.match(api,/pix_city=\$5/);const migration=read('db/022_supplier_pix_city.sql');assert.match(migration,/ADD COLUMN IF NOT EXISTS pix_city/);assert.doesNotMatch(migration,/DELETE|DROP TABLE|NOT NULL/);});
