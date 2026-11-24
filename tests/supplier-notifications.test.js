import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('avisos independentes são emitidos na mesma transação do recebimento e do repasse',()=>{
 const reconciler=read('lib/infinitepay-reconcile.js');
 const payout=read('app/api/admin/infinitepay/route.js');
 assert.ok(reconciler.includes("'supplier_payment_pending'"));
 assert.ok(reconciler.includes("'Pedido pago — aguardando repasse Pix da VELLOR'"));
 assert.ok(payout.includes("'supplier_paid','Repasse confirmado — pedido liberado para preparação'"));
 assert.ok(payout.includes("fulfillment_status='paid'"));
 assert.ok(payout.includes("group.fulfillment_status==='awaiting_payout'"));
 assert.ok(payout.includes("JOIN payments")||payout.includes("FROM payments"));
});
test('avisos não são exibidos para outros fornecedores',()=>{
 const supplierApi=read('app/api/suppliers/[action]/route.js');
 assert.ok(supplierApi.includes("g.supplier_id=$1 AND n.kind IN"));
 assert.ok(supplierApi.includes("g.supplier_id=$2 AND n.kind IN"));
 assert.ok(supplierApi.includes("await currentSupplier(req)"));
 assert.ok(supplierApi.includes("n.payload->>'group_id'=g.id::text"));
});
test('aviso de pagamento não libera endereço ou preparação antes do repasse',()=>{
 const api=read('app/api/suppliers/[action]/route.js');
 assert.ok(api.includes("g.fulfillment_status<>'awaiting_payout' THEN o.recipient_snapshot"));
 assert.ok(api.includes("g.payment_status='approved' AND g.fulfillment_status IN ('paid','preparing')"));
 assert.ok(api.includes("fulfillment_status='paid' RETURNING id"));
});
test('migração preserva notificações antigas, com leitura separada do ADM',()=>{
 const migration=read('db/009_supplier_notifications.sql');
 const bundle=read('lib/marketplace-schema-sql.mjs');
 const status=read('app/api/admin/marketplace-status/route.js');
 assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS supplier_notification_reads'));
 assert.ok(migration.includes('PRIMARY KEY(supplier_id,notification_id)'));
 assert.ok(bundle.includes("009_supplier_notifications.sql"));
 assert.ok(status.includes("supplier_notification_reads"));
 assert.ok(!migration.includes('DELETE FROM notifications'));
});
test('portal possui avisos novos, marcação independente e evita textos de split automático',()=>{
 const supplier=read('app/fornecedor/page.jsx');
 assert.ok(supplier.includes("supplier-notice-list"));
 assert.ok(supplier.includes("'suppliers/notifications'"));
 assert.ok(supplier.includes("'suppliers/notification-read'"));
 assert.ok(supplier.includes("VER AVISOS"));
 assert.ok(!supplier.includes("Carteira Asaas"));
 assert.ok(!supplier.includes("as tarifas efetivas seguem as regras do Mercado Pago"));
});
test('cabeçalho e rodapé seguem a identidade da vitrine nas rotas Next',()=>{
 const frame=read('components/Frame.jsx');
 const styles=read('app/globals.css');
 const groups=read('app/pagamento/grupos/page.jsx');
 const paid=read('app/pagamento/retorno/page.jsx');
 for(const section of ['vll-site-header','vll-brand','vll-app-footer']) {
  assert.ok(frame.includes(section));
  assert.ok(styles.includes('.'+section));
 }
 assert.ok(!frame.includes('className="vll-category-nav"'));
 assert.ok(read('public/vitrine.html').includes('category-nav'));
 assert.ok(frame.includes('logo-vellor.png'));
 assert.ok(groups.includes("<Frame user={null}>"));
 assert.ok(paid.includes("<Frame user={null}>"));
});

test('logo oficial, bandeiras aceitas e textura VELLOR em ambas as interfaces',()=>{
 const home=read('public/vitrine.html'),frame=read('components/Frame.jsx');
 const homeStyle=read('public/vellor-approved.css'),innerStyle=read('app/globals.css');
 const companyDomain='cdn.prod.website-files.com/65c1399ac999a342139b5069/';
 for(const content of [home,frame]){
  assert.ok(content.includes('InfinitePay'));
  assert.ok(content.includes('Logo_InfinitePay.svg'));
  for(const mark of ['Visa','Mastercard','Elo','American Express','Pix']){
   assert.ok(content.includes('alt="'+mark+'"'));
  }
  assert.ok(content.includes(companyDomain));
  assert.ok(!content.includes('Hipercard'));
 }
 for(const css of [homeStyle,innerStyle])assert.ok(css.includes("url('/vellor-header-texture.webp')"));
 assert.ok(homeStyle.includes('.site-footer{')&&homeStyle.includes('.vellor-payment-mark img'));
 assert.ok(innerStyle.includes('.vll-app-footer{')&&innerStyle.includes('.vll-payment-mark img'));
});
