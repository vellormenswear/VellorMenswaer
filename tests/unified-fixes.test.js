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
test('busca de categoria inclui todos os descendentes e reconhece subcategorias',()=>{
 const js=read('public/vellor-approved.js'),defaults=read('public/vellor-category-defaults.js');
 const a=js.indexOf('const slugOf='),b=js.indexOf('function browseCategory(',a),c=js.indexOf('const CATEGORY_SEARCH_ALIASES='),d=js.indexOf('function modelsSorted(){',c);
 assert.ok(a>=0&&b>a&&c>=0&&d>c);
 const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const fn=new Function('normalize',defaults+';let categoryTree=DEFAULT_CATEGORY_TREE,categoryTreeReady=false;'+js.slice(a,b)+js.slice(c,d)+';return {categoryForSearch,productMatchesSearch,matchesCategory}')(normalize);
 for(const s of ['relógio','relogio','RELÓGIOS','relogios'])assert.equal(fn.categoryForSearch(s),'relogios');
 assert.equal(fn.categoryForSearch('calcados'),'calcados');
 assert.equal(fn.categoryForSearch('vestuário esportivo'),'vestuario-esportivo');
 assert.equal(fn.categoryForSearch('camiseta'),'camisetas');
 assert.ok(fn.productMatchesSearch({category:'Relógios',name:'POEDAGAR 930',slug:'poedagar-930'},[],'relogio'));
 assert.ok(fn.matchesCategory({category:'Vestuário Esportivo',slug:'camiseta-dry-fit-malha-fria-1-unidade'},'vestuario'));
 assert.ok(fn.matchesCategory({category:'Estojos e organizadores',category_slug:'estojos-e-organizadores',slug:'estojo-exemplo'},'relogios'));
 assert.ok(!fn.productMatchesSearch({category:'Vestuário',name:'Camisa Social'},[],'relogio'));
 assert.ok(js.includes('searchCategory?matchesCategory(p,searchCategory)'));
});
test('gerenciamento de categoria exige administrador e impede hierarquia circular',()=>{
 const api=read('app/api/admin/[resource]/route.js'),picker=read('components/CategoryPicker.jsx'),manager=read('components/CategoryManager.jsx'),sql=read('db/011_category_hierarchy.sql');
 assert.ok(api.includes("ensure(parent!==id")&&api.includes('Uma categoria com subcategorias não pode virar subcategoria'));
 assert.ok(api.includes('pg_advisory_xact_lock'));
 assert.ok(picker.includes('Categoria principal')&&picker.includes('Subcategoria'));
 assert.ok(manager.includes('/api/admin/upload')&&manager.includes('sort_order'));
 assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS parent_id')&&!/DELETE FROM|DROP TABLE|TRUNCATE/i.test(sql));
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

test('conta e administração usam visual de aplicativo, editor de produto fica antes da lista',()=>{
 const admin=read('app/admin/page.jsx'),account=read('app/conta/page.jsx'),css=read('app/globals.css');
 assert.ok(admin.includes('vll-admin-app')&&account.includes('vll-account-app'));
 const start=admin.indexOf("{tab==='products'&&<>");
 assert.ok(start>=0&&admin.indexOf('ref={editorRef}',start)<admin.indexOf('className="productgrid"',start));
 assert.ok(admin.includes("scrollIntoView({behavior:'smooth',block:'start'})"));
 assert.ok(admin.includes('AppIcon name="trash"')&&admin.includes("post('product-delete'"));
 assert.ok(admin.includes('Prévia da foto principal')&&admin.includes('Prévia da variação'));
 assert.ok(css.includes('.vll-admin-app .sidebar button.active')&&css.includes('.app-photo-editor'));
});
test('exclusão administrativa protege vendas e referências históricas',()=>{
 const route=read('app/api/admin/[resource]/route.js');
 const start=route.indexOf("if(resource==='product-delete')"),end=route.indexOf("if(resource==='product')",start),code=route.slice(start,end);
 assert.ok(start>=0&&end>start);
 for(const snippet of ["requireRole(req,['admin','super_admin'])",'transaction(async c=>','order_items','supplier_stock_reservations','items_snapshot','SAVEPOINT product_remove','UPDATE products SET active=false,hidden=true','UPDATE product_variants SET active=false','INSERT INTO audit_logs'])assert.ok(code.includes(snippet),snippet);
 for(const path of ['app/api/infinitepay/[action]/route.js'])assert.ok(read(path).includes('v?.supplier_available&&v.active'));
});
test('upload e foto principal são associados ao catálogo e ao checkout',()=>{
 const route=read('app/api/admin/[resource]/route.js'),catalog=read('app/api/catalog/route.js'),commerce=read('lib/commerce.js'),upload=read('app/api/admin/upload/route.js');
 assert.ok(route.includes('INSERT INTO product_images(product_id,url,alt,sort_order)'));
 assert.ok(catalog.includes('cover.url')&&commerce.includes('cover.url'));
 assert.ok(upload.includes('BLOB_READ_WRITE_TOKEN')&&upload.includes("access:'public'")&&upload.includes('arquivo não corresponde a uma imagem válida'));
});

import {ADMIN_ORDER_FILTERS,orderFilterPredicate,pendingRefund,failedRefund,adminOrderPaymentLabel} from '../lib/admin-order-filters.mjs';
test('filtro administrativo diferencia cancelamento pago, estorno confirmado e pagamento aprovado',()=>{
 const canceled={status:'canceled',payment_status:'approved'};assert.equal(pendingRefund(canceled),true);assert.equal(adminOrderPaymentLabel(canceled,customerPaymentLabel),'Estorno pendente');assert.equal(pendingRefund({status:'canceled',payment_status:'refunded'}),false);assert.equal(adminOrderPaymentLabel({status:'canceled',payment_status:'refunded'},customerPaymentLabel),'Estornado');assert.equal(adminOrderPaymentLabel({status:'paid',payment_status:'approved'},customerPaymentLabel),'Pagamento confirmado');assert.equal(failedRefund({group_refund_failed:true}),true);assert.equal(adminOrderPaymentLabel({group_refund_pending:true,group_refund_failed:true},customerPaymentLabel),'Falha no estorno');for(const [key] of ADMIN_ORDER_FILTERS)assert.ok(orderFilterPredicate(key));assert.equal(orderFilterPredicate('invalid'),null);assert.equal(orderFilterPredicate('__proto__'),null);assert.ok(orderFilterPredicate('refund_pending').includes("o.status='canceled' AND o.payment_status='approved'"));assert.ok(orderFilterPredicate('approved').includes("o.status<>'canceled'"));const admin=read('app/admin/page.jsx'),api=read('app/api/admin/[resource]/route.js');assert.ok(admin.includes('Filtrar por situação')&&admin.includes('adminOrderPaymentLabel(o,customerPaymentLabel)'));assert.ok(api.includes('orderFilterPredicate(filter)')&&api.includes('LIMIT $1 OFFSET $2'));
});

import {productSlugBase} from '../lib/product-slug-base.mjs';
test('slug do produto opcional, automático e preservado em edição',()=>{assert.equal(productSlugBase('Camisa Pólo Azul'),'camisa-polo-azul');assert.equal(productSlugBase('!!!'),'produto');assert.ok(productSlugBase('a'.repeat(300)).length<=190);const h=read('lib/product-slug.js'),a=read('app/api/admin/[resource]/route.js'),s=read('app/api/suppliers/[action]/route.js'),ui=read('app/admin/page.jsx');assert.ok(h.includes('pg_advisory_xact_lock')&&h.includes('if(!manual&&existing)return existing')&&h.includes("base+'-'+n"));assert.ok(a.includes('resolveProductSlug(c,{name,requested,id:productId})')&&a.includes('return ok({id,slug})'));assert.ok(s.includes('resolveProductSlug(c,{name:sub.name'));assert.ok(ui.includes('Slug (identificador URL) — opcional'));});

test('detalhes administrativos exibem apenas a referência de estorno manual salva',()=>{const route=read('app/api/admin/[resource]/route.js'),page=read('app/admin/page.jsx'),refund=read('lib/admin-order-cancel.js');assert.ok(refund.includes('refund_reference:reference'));assert.ok(route.includes("['admin','super_admin'].includes(u.role)?")&&route.includes("raw_summary->>'refund_confirmation'='manual_provider_receipt'")&&route.includes("raw_summary->>'refund_reference' END AS refund_reference"));assert.ok(page.includes("adm&&p.status==='refunded'")&&page.includes('{p.refund_reference}')&&page.includes('Nenhuma referência manual disponível'));assert.ok(!route.includes('SELECT * FROM payments WHERE order_id=$1'));});

import {sizeChangeAllowed,availableSizes} from '../lib/order-size-change.mjs';
test('troca de tamanho só antes da postagem, com tamanho disponível e sem alteração financeira',()=>{const order={status:'paid',payment_status:'approved'},group={fulfillment_status:'preparing',payment_status:'approved'};assert.equal(sizeChangeAllowed(order,group),true);assert.equal(sizeChangeAllowed(order,{...group,posted_at:'2026-11-24'}),false);assert.equal(sizeChangeAllowed(order,{...group,fulfillment_status:'shipped'}),false);assert.equal(sizeChangeAllowed({...order,payment_status:'refunded'},group),false);assert.deepEqual(availableSizes(['P','M','G','G'],'M'),['P','G']);const api=read('app/api/admin/[resource]/route.js'),supplier=read('app/api/suppliers/[action]/route.js');const block=api.slice(api.indexOf("if(resource==='order-size')"),api.indexOf("if(resource==='order-status')"));assert.ok(block.includes('FOR UPDATE OF g')&&block.includes('UPDATE supplier_order_items SET size_snapshot')&&block.includes('UPDATE order_items SET size_snapshot')&&block.includes('supplier_size_changed')&&block.includes('customer_order_size_changed'));assert.ok(!block.includes('UPDATE payments')&&!block.includes('SET total_cents'));assert.ok(supplier.includes('revisions.rows.every(n=>n.acknowledged)')&&supplier.includes('x.size_revision'));});

test('gerenciador inicia com subcategorias recolhidas e permite expandir uma categoria por vez',()=>{const manager=read('components/CategoryManager.jsx'),css=read('app/globals.css');assert.ok(manager.includes('[expanded,setExpanded]=useState(null)'));assert.ok(manager.includes('open=expanded===root.id'));assert.ok(manager.includes('setExpanded(prev=>prev===root.id?null:root.id)'));assert.ok(manager.includes('aria-expanded={open}')&&manager.includes('hidden={!open}')&&manager.includes('open&&(children.length?children.map'));assert.ok(manager.includes('onClick={()=>edit(root)}')&&manager.includes('onClick={()=>edit(c)}'));assert.ok(css.includes('.vll-category-children[hidden]{display:none!important}'));});
