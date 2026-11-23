import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shippingDeadline,isShipmentPending,shippingAlerts} from '../lib/shipping-deadline.mjs';
import {isBrazilianDocument,normalizeIdentity,publicLegalIdentity} from '../lib/store-identity.mjs';
import {customerOrderLabel,customerPaymentLabel,customerRequestLabel} from '../lib/customer-order-status.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('setas laterais são posicionadas sobre as imagens',()=>{
 const html=read('public/vitrine.html'),css=read('public/vellor-approved.css');
 assert.equal(html.split('id="vellor-products-prev"').length-1,1);
 assert.equal(html.split('id="vellor-products-next"').length-1,1);
 const shell=html.slice(html.indexOf('class="vellor-carousel-shell"'),html.indexOf('id="cart-page"'));
 for(const name of ['vellor-carousel-prev','vellor-carousel-next','id="grid"'])assert.ok(shell.includes(name));
 assert.ok(css.includes('position:absolute;top:31%'));
 assert.ok(css.includes('.vellor-carousel-prev{left:'));
 assert.ok(css.includes('.vellor-carousel-next{right:'));
});
test('busca de categoria inclui todos os relógios mesmo sem termo no título',()=>{
 const js=read('public/vellor-approved.js');
 const a=js.indexOf('const CATEGORY_SEARCH_ALIASES='),b=js.indexOf('function modelsSorted(){',a);
 assert.ok(a>=0&&b>a);
 const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const CATEGORIES=['Todos','Relógios','Vestuário','Acessórios','Calçados','Vestuário Esportivo'];
 const fn=new Function('normalize','CATEGORIES',js.slice(a,b)+';return {categoryForSearch,productMatchesSearch}')(normalize,CATEGORIES);
 for(const s of ['relógio','relogio','RELÓGIOS','relogios'])assert.equal(fn.categoryForSearch(s),'Relógios');
 assert.equal(fn.categoryForSearch('calcados'),'Calçados');
 assert.equal(fn.categoryForSearch('vestuário esportivo'),'Vestuário Esportivo');
 assert.equal(fn.categoryForSearch('acessorios'),'Acessórios');
 assert.equal(fn.categoryForSearch('camiseta'),null);
 assert.ok(fn.productMatchesSearch({category:'Relógios',name:'POEDAGAR 930'},[{sku:'VL1',variant:'Prata'}],'relogio'));
 assert.ok(!fn.productMatchesSearch({category:'Vestuário',name:'Camisa Social'},[],'relogio'));
 assert.ok(fn.productMatchesSearch({category:'Vestuário',name:'Camiseta básica'},[],'camiseta'));
 assert.ok(js.includes('searchCategory?p.category===searchCategory'));
});
test('botão do chat só tem ícone, formato circular e mantém acessibilidade',()=>{
 const html=read('public/vitrine.html'),widget=read('components/SupportWidget.jsx'),css=read('public/vellor-support.css');
 assert.ok(html.includes('id="vellor-support-toggle"'));
 assert.ok(html.includes('aria-label="Abrir atendimento VELLOR"'));
 assert.ok(!html.includes('class="vellor-support-fab-label"'));
 assert.ok(!widget.includes('className="vellor-support-fab-label"'));
 assert.ok(css.includes('width:58px!important;height:58px!important'));
 assert.ok(css.includes('border-radius:50%!important'));
});
test('os clientes não veem códigos internos de pedidos',()=>{
 assert.equal(customerOrderLabel('paid'),'Pagamento confirmado');
 assert.equal(customerOrderLabel('processing'),'Pedido em preparação');
 assert.equal(customerOrderLabel('shipped'),'Enviado');
 assert.equal(customerPaymentLabel('approved'),'Pagamento confirmado');
 assert.equal(customerRequestLabel('under_review'),'Em análise');
 assert.equal(customerOrderLabel('internal_unmapped'),'Em acompanhamento');
 const ui=read('app/conta/page.jsx');
 for(const snippet of ['customerOrderLabel(o.status)','customerPaymentLabel(o.payment_status)','customerOrderLabel(h.to_status)'])assert.ok(ui.includes(snippet));
 assert.ok(!ui.includes('{h.note}'));
});
test('prazo de envio começa em paid_at e termina 72h depois',()=>{
 const paid='2026-11-20T10:00:00.000Z';
 assert.equal(shippingDeadline(paid,'2026-11-21T09:00:00Z').alert,'on_track');
 assert.equal(shippingDeadline(paid,'2026-11-22T10:00:00Z').alert,'urgent');
 assert.equal(shippingDeadline(paid,'2026-11-23T10:00:01Z').alert,'late');
 assert.equal(shippingDeadline(paid,'2026-11-21T10:00:00Z').deadline_at,'2026-11-23T10:00:00.000Z');
 const api=read('app/api/admin/[resource]/route.js'),admin=read('app/admin/page.jsx');
 assert.ok(api.includes('o.paid_at IS NOT NULL'));
 assert.ok(api.includes("hasPermission(u,'orders.read')"));
 assert.ok(admin.includes('Controle de postagem'));
});
test('remessas independentes só concluem o envio depois de todas postadas',()=>{
 assert.ok(isShipmentPending({status:'paid',shipment_count:2,shipments_finished:1}));
 assert.ok(!isShipmentPending({status:'paid',shipment_count:2,shipments_finished:2}));
 assert.ok(!isShipmentPending({status:'shipped',shipment_count:0,shipments_finished:0}));
 const list=[{id:'a',status:'paid',payment_status:'approved',paid_at:'2026-11-20T10:00:00Z',shipment_count:2,shipments_finished:1},
  {id:'b',status:'paid',payment_status:'approved',paid_at:'2026-11-20T10:00:00Z',shipment_count:2,shipments_finished:2}];
 assert.deepEqual(shippingAlerts(list,'2026-11-24T10:00:00Z').map(x=>x.id),['a']);
});
test('identificação legal é validada, sem dados presumidos ou publicação parcial',()=>{
 assert.ok(isBrazilianDocument('529.982.247-25'));
 assert.ok(isBrazilianDocument('11.222.333/0001-81'));
 assert.ok(!isBrazilianDocument('111.111.111-11'));
 assert.deepEqual(publicLegalIdentity(normalizeIdentity({})),{complete:false});
 const d=normalizeIdentity({legal_name:'Comerciante Exemplo',legal_document:'529.982.247-25',legal_address:'Rua Ilustrativa 12, Centro, Rio de Janeiro, RJ, 00000-000',legal_email:'teste@example.com'});
 assert.ok(d.complete);
 const p=publicLegalIdentity(d);
 assert.equal(p.legal_document,'529.982.247-25');
 assert.equal(p.legal_document_kind,'CPF');
 const api=read('app/api/store/identity/route.js'),admin=read('app/api/admin/[resource]/route.js');
 assert.ok(api.includes('publicLegalIdentity'));
 assert.ok(api.includes('no-store'));
 assert.ok(admin.includes("resource==='legal-identity'"));
 assert.ok(read('app/admin/page.jsx').includes('SALVAR IDENTIFICAÇÃO LEGAL'));
 assert.ok(read('public/vellor-identity.js').includes('if(!data?.complete)return'));
});
test('carrinho checkout políticas e atendimento continuam disponíveis',()=>{
 const html=read('public/vitrine.html'),js=read('public/vellor-approved.js');
 assert.ok(html.includes('id="cart-page"'));
 assert.ok(js.includes('async function goCheckout()'));
 assert.ok(html.includes('class="vellor-trust"'));
 for(const route of ['/entregas','/trocas-e-devolucoes','/privacidade','/termos-de-compra'])assert.ok(html.includes(route));
 assert.ok(!html.includes('Navegue por preço'));
});

test('painel financeiro mantém regras de reserva e navegação funcional',()=>{
 const page=read('app/admin/financeiro/page.jsx'),css=read('app/admin/financeiro/finance.module.css');
 assert.ok(page.includes('reserveSummary({approvedFees:commissions,expenses,losses,recoveries})'));
 assert.ok(page.includes('cost=revenue-commissions'));
 assert.ok(page.includes('pct(commissions)')&&page.includes('pct(profit)'));
 assert.ok(page.includes('parts.every(p=>p.value>=0)'));
 assert.ok(page.includes('Disponibilidade gerencial estimada, não saldo bancário'));
 assert.ok(page.includes('Tarifas não conciliadas podem reduzir o resultado'));
 for(const tab of ['summary','movement','refunds','reports'])assert.ok(page.includes("tab==='"+tab+"'"));
 assert.ok(page.includes("req('admin-finance-adjustment','POST'"));
 assert.ok(page.includes("['refunded','refund_pending','refund_failed']"));
 assert.ok(page.includes("hidden?'R$ ••••':money(n)"));
 assert.ok(css.includes('@media(max-width:520px)'));
 assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
});
