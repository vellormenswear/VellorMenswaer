import test from 'node:test';
import {canPurchase} from '../lib/purchase-role.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {infinitepayConfigured,infinitepayReady,buildInfinitepayCheckout,verifiedInfinitepayPayment,safeInfiniteCheckoutLink} from '../lib/infinitepay.mjs';
const id='550e8400-e29b-41d4-a716-446655440000';
const env={INFINITEPAY_API_KEY:'inchk_test_only_not_a_real_key_1234',INFINITEPAY_HANDLE:'minha-loja',INFINITEPAY_CHECKOUT_ENABLED:'true',STORE_OPEN_FOR_ORDERS:'true',INFINITEPAY_TEST_CUSTOMER_EMAIL:'cliente@example.com',DATABASE_URL:'postgres://test',SITE_URL:'https://vellormenswear.vercel.app'};
test('checkout liberado para todas as contas de clientes com controles comerciais ativos',()=>{
 assert.equal(infinitepayConfigured(env),true);
 const customer=(email)=>({role:'customer',email});
 for(const e of ['cliente@example.com','outro@example.com','nova.conta@exemplo.com']){
  assert.equal(infinitepayReady(env,customer(e)),true);
 }
 assert.equal(infinitepayReady({...env,INFINITEPAY_TEST_CUSTOMER_EMAIL:''},customer('nova.conta@exemplo.com')),true,
  'O antigo e-mail de homologação não deve mais restringir compras');
});
test('checkout real continua bloqueado sem credenciais, chaves ou conta autorizada',()=>{
 for(const part of [{INFINITEPAY_CHECKOUT_ENABLED:'false'},{STORE_OPEN_FOR_ORDERS:'false'},
   {INFINITEPAY_API_KEY:''},{INFINITEPAY_HANDLE:''},{DATABASE_URL:''},{SITE_URL:'http://unsafe.example'}]){
  assert.equal(infinitepayReady({...env,...part},{role:'customer',email:'outro@example.com'}),false);
 }
 for(const role of ['supplier','employee',null]){
  assert.equal(infinitepayReady(env,{role,email:'outro@example.com'}),false);
 }
 assert.equal(infinitepayReady(env,null),false);
});
test('links de uso unico, expiracao, soma em centavos e webhook',()=>{
 const b=buildInfinitepayCheckout([{amount_cents:17000,supplier_amount_cents:10000}],
 {batchId:id,site:env.SITE_URL,expiresAt:new Date(Date.now()+7200000).toISOString()});
 assert.equal(b.total_cents,17000);assert.equal(b.supplier_cents,10000);
 assert.deepEqual(b.payload.items,[{description:'VELLOR - pedido 1',price:17000,quantity:1}]);
 assert.equal(b.payload.order_nsu,id);
 assert.equal(b.payload.options.single_payment,true);
 assert.deepEqual(b.payload.webhook.events,['paid','refunded','canceled']);
 assert.ok(!JSON.stringify(b.payload).includes('splits'));
});
test('nunca aceitar aprovacao sem resultado da API e total conferido',()=>{
 const yes={success:true,paid:true,amount:17000,paid_amount:17450,capture_method:'credit_card'};
 assert.equal(verifiedInfinitepayPayment(yes,17000),true);
 assert.equal(verifiedInfinitepayPayment({...yes,amount:100},17000),false);
 assert.equal(verifiedInfinitepayPayment({...yes,paid:false},17000),false);
 assert.equal(verifiedInfinitepayPayment({...yes,success:false},17000),false);
 assert.equal(verifiedInfinitepayPayment({...yes,paid_amount:14000},17000),false);
});
test('somente links HTTPS oficiais podem ser abertos',()=>{
 assert.equal(safeInfiniteCheckoutLink('https://checkout.infinitepay.io/pay/abc'),'https://checkout.infinitepay.io/pay/abc');
 for(const uri of ['http://checkout.infinitepay.io','https://infinitepay.io.evil.com/','https://other.com','javascript:alert(1)'])
  assert.equal(safeInfiniteCheckoutLink(uri),null);
});
test('migracao preserva registros e exige repasse manual',()=>{
 const schema=readFileSync(new URL('../db/008_infinitepay.sql',import.meta.url),'utf8');
 assert.match(schema,/CREATE TABLE IF NOT EXISTS supplier_manual_payouts/);
 assert.match(schema,/awaiting_payout/);
 const webhook=readFileSync(new URL('../app/api/webhooks/infinitepay/route.js',import.meta.url),'utf8');
 assert.match(webhook,/reconcileInfinitepayBatch/);
 assert.match(webhook,/payment_check|reconcileInfinitepayBatch/);
});

test('reconciliacao nao sombreia funcao de transacao e respeita status de pedidos',()=>{
 const source=readFileSync(new URL('../lib/infinitepay-reconcile.js',import.meta.url),'utf8');
 assert.match(source,/const transactionNsu=String/);
 assert.doesNotMatch(source,/const transaction=String/);
 assert.ok(source.includes('return transaction(async c=>'));
 assert.ok(source.includes("stockOk?'paid':'cancel_requested'"));
 assert.ok(source.includes("stockOk?'awaiting_payout':'cancel_requested'"));
});

test('nao duplica link externo e valida retorno mesmo com checkout desativado',()=>{
 const route=readFileSync(new URL('../app/api/infinitepay/[action]/route.js',import.meta.url),'utf8');
 const reservation=route.indexOf("INSERT INTO infinitepay_checkout_batches");
 const provider=route.indexOf("infinitepayApi('/links'");
 assert.ok(reservation>=0&&provider>reservation,'Reserva idempotente deve preceder chamada ao provedor');
 const verify=route.indexOf("if(action==='recheck-payment')");
 const gate=route.indexOf("ensure(infinitepayReady(process.env,u)");
 assert.ok(verify>=0&&gate>verify,'Verificacao de compras antigas nao pode depender da chave de habilitacao');
 const page=readFileSync(new URL('../app/pagamento/grupos/page.jsx',import.meta.url),'utf8');
 assert.match(page,/RETURN_RECHECK_FAILED/);
 assert.ok(page.includes("params.get('order_nsu')"));
});

test('conciliacao administrativa consulta pagamento existente sem nova cobranca',()=>{
 const route=readFileSync(new URL('../app/api/admin/infinitepay/route.js',import.meta.url),'utf8');
 assert.ok(route.includes("x.action==='reconcile_payment'"));
 assert.ok(route.includes("reconcileInfinitepayBatch(x.checkout_id"));
 assert.ok(route.includes("await requireRole(req,['super_admin'])"));
 const page=readFileSync(new URL('../app/admin/infinitepay/page.jsx',import.meta.url),'utf8');
 assert.ok(page.includes('CONSULTAR PAGAMENTO OFICIAL'));
 assert.ok(page.includes("q.get('transaction_nsu')"));
});

test('cancelamento administrativo exige permissão e estorno separado com prova e valores',()=>{
 const route=readFileSync(new URL('../app/api/admin/[resource]/route.js',import.meta.url),'utf8');
 const cancel=readFileSync(new URL('../lib/admin-order-cancel.js',import.meta.url),'utf8');
 const customer=readFileSync(new URL('../app/api/account/[resource]/route.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../app/conta/page.jsx',import.meta.url),'utf8');
 assert.ok(route.includes("requireRole(req,['admin','super_admin']);ensure(uuid(x.id)"));
 assert.ok(route.includes("ensure(to!=='canceled'"));
 assert.ok(cancel.includes("fulfillment_status='canceled'"));
 assert.ok(cancel.includes("THEN 'refund_pending'"));
 assert.ok(cancel.includes('confirmed===true'));
 assert.ok(cancel.includes("refund_confirmation:'manual_provider_receipt'"));
 assert.ok(cancel.includes("batch.payment_method==='credit_card'?gs:[target]"));
 assert.ok(cancel.includes("payment_status='refunded'"));
 assert.ok(cancel.includes("status='committed' RETURNING variant_id,quantity"));
 assert.ok(customer.includes("WHERE o.customer_id=$1 AND n.kind IN ('customer_order_canceled','customer_order_refunded')"));
 assert.ok(ui.includes('O estorno de '));
 assert.ok(ui.includes('foi confirmado para o meio de pagamento de origem'));
});

test('ADM e Super ADM compram com a própria conta, sem dispensar controles comerciais ou de titularidade',()=>{
 for(const role of ['customer','admin','super_admin']){const user={role};assert.equal(canPurchase(user),true);assert.equal(infinitepayReady(env,user),true);assert.equal(infinitepayReady({...env,STORE_OPEN_FOR_ORDERS:'false'},user),false);assert.equal(infinitepayReady({...env,INFINITEPAY_CHECKOUT_ENABLED:'false'},user),false);}
 for(const role of ['supplier','employee','unknown',null])assert.equal(canPurchase({role}),false);assert.equal(canPurchase(null),false);
 const route=readFileSync(new URL('../app/api/infinitepay/[action]/route.js',import.meta.url),'utf8');assert.ok(route.includes('ensure(canPurchase(u)'));assert.ok(route.includes('WHERE id=$1 AND user_id=$2'));assert.ok(route.includes('WHERE checkout_batch_id=$1 AND customer_id=$2'));assert.ok(route.includes('quoteCart(x.items,x.coupon)'));assert.ok(route.includes('reconcileInfinitepayBatch'));
 const page=readFileSync(new URL('../app/finalizar/page.jsx',import.meta.url),'utf8');assert.ok(page.includes('ordersOpen&&canPurchase(user)'));assert.ok(page.includes('!canPurchase(user)'));
 const account=readFileSync(new URL('../app/conta/page.jsx',import.meta.url),'utf8');assert.ok(account.includes('returnToCheckout()&&canPurchase(r.user)'));assert.ok(account.includes('canPurchase(user)&&notifications.length'));
});
