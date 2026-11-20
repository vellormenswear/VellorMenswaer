import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkoutReady,discountedPreferenceItems,paidStatus} from '../lib/supplier-checkout.mjs';
const read=path=>readFileSync(path,'utf8');

test('a intenção de checkout não cria pedido ou debita estoque antes de pagar',()=>{
 const api=read('app/api/marketplace/[action]/route.js');
 const create=api.slice(api.indexOf("if(action==='checkout-create')"),api.indexOf("if(action==='retry-preference')"));
 assert.ok(!/INSERT\s+INTO\s+orders/i.test(create));
 assert.ok(!/SET\s+stock\s*=\s*stock\s*-/i.test(create));
 assert.match(create,/INSERT INTO supplier_order_groups\(checkout_batch_id,customer_id/);
 assert.match(create,/INSERT INTO supplier_stock_reservations/);
 assert.match(create,/requireUser\(req\)/);
 assert.match(create,/u\.role==='customer'/);
});

test('somente conciliação de pagamento aprovado gera pedido, com bloqueio transacional',()=>{
 const recon=read('lib/split-reconcile.js');
 assert.match(recon,/if\(paidStatus\(payment\)\)/);
 assert.match(recon,/SELECT \* FROM supplier_order_groups WHERE id=\$1 FOR UPDATE/);
 assert.match(recon,/if\(!orderId\)/);
 assert.match(recon,/INSERT INTO orders\(/);
 assert.match(recon,/provider_payment_id&&before\.provider_payment_id!==id/);
 assert.match(recon,/checkout_coupon_redemptions/);
 assert.match(recon,/INSERT INTO payments\(/);
 assert.equal(paidStatus({status:'pending'}),false);
 assert.equal(paidStatus({status:'rejected'}),false);
 assert.equal(paidStatus({status:'approved'}),true);
});

test('webhook exige assinatura e consulta pagamento real do provedor',()=>{
 const webhook=read('app/api/webhooks/mercadopago/route.js');
 assert.match(webhook,/verifyMPWebhook\(/);
 assert.match(webhook,/mpRequest\('\/v1\/payments\/'/);
 assert.match(webhook,/reconcilePayment\(payment,expectedSeller\)/);
 assert.match(webhook,/payment\.external_reference\)===groupId/);
});

test('preços em centavos continuam exatos ao criar preferências do Split',()=>{
 const items=[{sku:'A',name:'Camisa',variant:'Azul',qty:2,unit_cents:13999},{sku:'B',name:'Relógio',variant:'Prata',qty:1,unit_cents:12000}];
 const total=39998-1001; // 2x13999 + 12000 = 39998
 const result=discountedPreferenceItems(items,total);
 assert.equal(result.reduce((n,x)=>n+Math.round(x.unit_price*100),0),total);
 assert.equal(result.length,3);
 assert.ok(result.every(x=>x.unit_price>0&&x.currency_id==='BRL'));
 assert.throws(()=>discountedPreferenceItems(items,0));
});

test('produção bloqueada sem confirmação explícita, testes precisam de credenciais',()=>{
 const env={MP_MODE:'production',MP_SPLIT_ENABLED:'true',STORE_OPEN_FOR_ORDERS:'true',DATABASE_URL:'db',MP_CLIENT_ID:'id',MP_CLIENT_SECRET:'secret',MP_TOKEN_ENCRYPTION_KEY:'key',MP_WEBHOOK_SECRET:'webhook',SITE_URL:'https://vellor.example'};
 assert.equal(checkoutReady(env),false);
 assert.equal(checkoutReady({...env,MP_LIVE_ENABLED:'true'}),true);
 assert.equal(checkoutReady({...env,MP_MODE:'sandbox'}),true);
 assert.equal(checkoutReady({...env,MP_LIVE_ENABLED:'true',MP_WEBHOOK_SECRET:''}),false);
});

test('migração não destrutiva preserva pedidos antigos e permite grupos ainda sem pedido',()=>{
 const migration=read('db/004_paid_orders_only.sql');
 assert.match(migration,/ALTER COLUMN order_id DROP NOT NULL/);
 assert.match(migration,/checkout_batch_id/);
 assert.ok(!/DROP TABLE/i.test(migration));
 assert.match(migration,/checkout_coupon_redemptions/);
});
