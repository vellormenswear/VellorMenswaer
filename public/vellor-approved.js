
const tr=(stage,meta)=>window.VellorTrace?.event(stage,meta||{});
const ts=(stage,meta)=>window.VellorTrace?.success(stage,meta||{});
const te=(stage,code,message,meta)=>window.VellorTrace?.error(stage,code,message,meta||{});
const tid=()=>window.VellorTrace?.id||null;
let categoryTree=DEFAULT_CATEGORY_TREE,categoryTreeReady=false;
const routeSlug=location.pathname.match(/^\/([a-z0-9-]+)\/?$/)?.[1]||null;
const fullCatalog=routeSlug==='produtos'||new URLSearchParams(location.search).get('catalogo')==='1';
let pageParent=null,pageLeaf=null;
function resolveCategoryRoute(){
 const entry=categoryTree.find(c=>c.slug===routeSlug);
 pageParent=routeSlug&&!fullCatalog?(entry?.parent_slug||routeSlug):null;
 pageLeaf=entry?.parent_slug&&!fullCatalog?entry.slug:null;
}
resolveCategoryRoute();
const featuredRanks=new Map();
function featuredRank(model){if(!featuredRanks.has(model.slug))featuredRanks.set(model.slug,Math.random());return featuredRanks.get(model.slug);}
const categoryUrl=(root,leaf)=>'/'+encodeURIComponent(leaf&&leaf!=='todos'?leaf:root);
let PRODUCTS=[],catalogLoaded=false,catalogFailed=false;
let models=[...new Map(PRODUCTS.map(p=>[p.slug,p])).values()];
const MONEY=n=>typeof n==='number'?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n):'Preço a confirmar';
const htmlEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let active=pageLeaf&&pageLeaf!=='todos'?pageLeaf:pageParent||'Todos',selected=null,selectedSize='',cart=[],galleryMap={},coupon='',quoteSerial=0;
try{const old=JSON.parse(localStorage.getItem('goston-cart-preview')||localStorage.getItem('vellor-modern-preview-cart')||'[]'); if(Array.isArray(old))cart=old;}catch{}
function save(){try{localStorage.setItem('goston-cart-preview',JSON.stringify(cart))}catch{};document.getElementById('cart-count').textContent=cart.reduce((n,x)=>n+x.qty,0)}
function groupFor(p){return PRODUCTS.filter(x=>x.slug===p.slug)}
function sizesFor(p){return Array.isArray(p.sizes)?p.sizes:(typeof p.sizes==='string'?p.sizes.split(',').map(s=>s.trim()).filter(Boolean):[])}
function available(p){return p&&typeof p.price_brl==='number'&&Number.isFinite(p.price_brl)&&p.price_brl>=0&&typeof p.image_url==='string'&&!!p.image_url}
function bySku(sku){return PRODUCTS.find(p=>p.sku===sku)}
function photo(p){return `<div class="photo"><div class="photo-placeholder"><svg viewBox="0 0 50 50"><path d="M25 4 44 25 25 46 6 25 25 4ZM17 25h16M25 17v16"/></svg><span>Imagem do produto indisponível</span></div><img src="${htmlEsc(p.image_url)}" alt="${htmlEsc(p.name)} — ${htmlEsc(p.variant)}" loading="lazy" onload="this.parentNode.classList.add('is-loaded')" onerror="this.remove()"></div>`}
function choose(category,top=false){if((pageParent||fullCatalog)&&category==='Todos'){location.assign('/');return;}document.getElementById('max-price').value='';if(location.hash==='#carrinho'){location.hash='colecao';document.getElementById('catalog-page').hidden=false;document.getElementById('cart-page').hidden=true;}active=category;document.getElementById('search').value='';document.getElementById('color').value='';document.getElementById('size').value='';render();if(!top)document.getElementById('colecao').scrollIntoView({behavior:'smooth',block:'start'});else scrollTo({top:0,behavior:'smooth'})}
function toggleFilters(){const el=document.getElementById('filter-panel'),b=document.getElementById('filter-toggle');const open=el.classList.toggle('open');b.classList.toggle('active',open);b.setAttribute('aria-expanded',open)}
function resetFilters(){['max-price','color','size'].forEach(id=>document.getElementById(id).value='');document.getElementById('search').value='';render()}

/* Navegação textual de categorias, sem fotos promocionais. */
const slugOf=s=>normalize(s).trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function categoryKeys(p){
 const actual=p.category_slug||slugOf(p.category||'');
 if(categoryTreeReady)return {leaf:actual,root:p.parent_slug||actual};
 const leaf=DEFAULT_MODEL_CATEGORIES[p.slug]||actual;
 const entry=categoryTree.find(c=>c.slug===leaf);
 return {leaf,root:entry?.parent_slug||leaf};
}
function matchesCategory(p,slug){const keys=categoryKeys(p);return slug==='Todos'||keys.leaf===slug||keys.root===slug}
function browseCategory(category){location.assign(categoryUrl(category))}
let openCategory=null;
function setCategoryMenu(slug){
 openCategory=slug;
 document.querySelectorAll('#vellor-category-rail .vellor-menu-item').forEach(item=>{
  const on=item.dataset.category===slug;
  item.querySelector('button').setAttribute('aria-expanded',String(on));
  item.querySelector('.vellor-mega-menu').hidden=!on;
 });
}
function bindCategoryMenu(){
 const nav=document.getElementById('vellor-root-nav');
 if(nav.dataset.bound)return;nav.dataset.bound='1';
 nav.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse'||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;const item=e.target.closest('.vellor-menu-item');if(item)setCategoryMenu(item.dataset.category);});
 nav.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!nav.contains(document.activeElement))setCategoryMenu(null)});
 nav.addEventListener('click',e=>{const button=e.target.closest('.vellor-menu-trigger');if(!button)return;const slug=button.closest('.vellor-menu-item').dataset.category;setCategoryMenu(openCategory===slug?null:slug)});
 nav.addEventListener('focusout',e=>{if(!nav.contains(e.relatedTarget))setCategoryMenu(null)});
 nav.addEventListener('keydown',e=>{if(e.key==='Escape'){const trigger=nav.querySelector('.vellor-menu-trigger[aria-expanded="true"]');setCategoryMenu(null);trigger?.focus();e.preventDefault();}});
 document.addEventListener('pointerdown',e=>{if(!nav.contains(e.target))setCategoryMenu(null)});
}
function renderDiscovery(){
 const nav=document.getElementById('vellor-root-nav'),categories=document.getElementById('vellor-category-rail'),panel=document.getElementById('vellor-subcategory-panel');
 if(!nav||!categories||!panel)return;
 const valid=models.filter(p=>groupFor(p).some(available));
 const roots=categoryTree.filter(c=>!c.parent_slug),parent=roots.find(c=>c.slug===pageParent),leaf=categoryTree.find(c=>c.slug===pageLeaf&&c.parent_slug===pageParent);
 const isCart=location.hash==='#carrinho',invalid=Boolean(pageParent&&(!parent||(pageLeaf&&pageLeaf!=='todos'&&!leaf)));
 const visible=c=>valid.some(p=>matchesCategory(p,c.slug));
 const markup=roots.filter(visible).map((root,i)=>{
  const children=categoryTree.filter(c=>c.parent_slug===root.slug&&visible(c));
  const id='vellor-menu-'+i,selected=pageParent===root.slug;
  return `<li class="vellor-menu-item" data-category="${htmlEsc(root.slug)}"><button type="button" class="vellor-menu-trigger ${selected?'active':''}" aria-expanded="false" aria-controls="${id}">${htmlEsc(root.name)}</button><div class="vellor-mega-menu" id="${id}" hidden><div class="vellor-mega-inner"><div class="vellor-mega-label">${htmlEsc(root.name)}</div><div class="vellor-mega-links">${children.map(c=>`<a href="${htmlEsc(categoryUrl(root.slug,c.slug))}">${htmlEsc(c.name)}</a>`).join('')}<a class="vellor-menu-all" href="${htmlEsc(categoryUrl(root.slug,'todos'))}">Ver tudo <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7"/></svg></a></div></div></div></li>`;
 }).join('');
 if(categories.dataset.markup!==markup){categories.innerHTML=markup;categories.dataset.markup=markup;setCategoryMenu(openCategory&&roots.some(c=>c.slug===openCategory&&visible(c))?openCategory:null);}
 bindCategoryMenu();
 nav.hidden=isCart;if(isCart)setCategoryMenu(null);
 panel.hidden=isCart||!invalid;
 document.getElementById('catalog-page').hidden=isCart||invalid;
 document.getElementById('vellor-category-breadcrumb').hidden=!pageParent||isCart;
 const crumb=document.getElementById('vellor-parent-crumb');crumb.textContent=parent?.name||'Categoria';crumb.href=parent?categoryUrl(parent.slug):'/';
 document.getElementById('vellor-leaf-crumb').textContent=pageLeaf?(leaf?.name||'Todos os produtos'):'';
 document.querySelector('#colecao h1').textContent=pageParent?(leaf?.name||parent?.name||'Produtos'):'Produtos';
 if(invalid)document.getElementById('vellor-subcategory-title').textContent='Categoria não encontrada';
 if(pageParent)document.title=(leaf?.name||parent?.name||'Categoria')+' — VELLOR Menswear';
}
function focusSearch(){if(location.hash==='#carrinho'){location.hash='busca';}document.getElementById('search').focus();}
function slideProducts(direction){
 const rail=document.getElementById('grid'),card=rail?.querySelector('.card');
 if(!rail||!card||!rail.classList.contains('vellor-product-rail'))return;
 rail.scrollBy({left:direction*(card.getBoundingClientRect().width+26)*2,behavior:'smooth'});
}
function updateProductNav(){
 const rail=document.getElementById('grid'),prev=document.getElementById('vellor-products-prev'),next=document.getElementById('vellor-products-next');
 if(!rail||!prev||!next)return;
 const carousel=rail.classList.contains('vellor-product-rail');
 prev.hidden=next.hidden=!carousel;
 const overflow=carousel&&rail.scrollWidth>rail.clientWidth+5;
 prev.disabled=!overflow||rail.scrollLeft<=5;
 next.disabled=!overflow||rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-5;
}

/* Busca por categoria: termo completo (singular/plural, com ou sem acento)
   mostra TODOS os produtos da categoria, mesmo sem o termo no título. */
const CATEGORY_SEARCH_ALIASES={'relogio':'relogios','relogios':'relogios','calcado':'calcados','calcados':'calcados','sapatos':'sapatos-sociais','acessorio':'acessorios','acessorios':'acessorios','vestuario':'vestuario','roupas':'vestuario','vestuario esportivo':'vestuario-esportivo','esportivo':'vestuario-esportivo','roupa esportiva':'vestuario-esportivo','roupas esportivas':'vestuario-esportivo','camiseta':'camisetas','camisa':'camisas','polo':'polos','calca':'calcas','tenis casual':'tenis-casuais','tenis esportivo':'tenis-esportivos','oculos':'oculos-de-sol','pulseira':'pulseiras','carteira':'carteiras','cinto':'cintos','anel':'aneis','mochila':'bolsas-e-mochilas'};
function categoryForSearch(raw){
 const term=normalize(raw).trim().replace(/\s+/g,' ');
 if(!term)return null;
 return categoryTree.find(c=>normalize(c.name)===term||c.slug===slugOf(term))?.slug||categoryTree.find(c=>c.slug===CATEGORY_SEARCH_ALIASES[term])?.slug||null;
}
function productMatchesSearch(p,all,search){
 if(!search)return true;
 const category=categoryForSearch(search);
 if(category)return matchesCategory(p,category);
 return normalize(p.name+' '+p.category+' '+(p.parent_category||'')+' '+all.map(x=>x.variant+' '+x.sku).join(' ')).includes(search);
}
function modelsSorted(){let a=models.filter(p=>{const all=groupFor(p),max=document.getElementById('max-price').value,search=normalize(document.getElementById('search').value).trim(),color=normalize(document.getElementById('color').value),size=document.getElementById('size').value,searchCategory=categoryForSearch(search);
return (searchCategory?matchesCategory(p,searchCategory):matchesCategory(p,active))&&productMatchesSearch(p,all,search)&&(!color||all.some(x=>normalize(x.variant).includes(color)))&&(!size||all.some(x=>sizesFor(x).includes(size)))&&(!max||all.some(x=>available(x)&&x.price_brl<=Number(max)))});
const sort=document.getElementById('sort').value;
const low=p=>Math.min(...groupFor(p).filter(available).map(x=>x.price_brl),Infinity);
if(sort==='low')a.sort((p,q)=>low(p)-low(q));else if(sort==='high')a.sort((p,q)=>low(q)-low(p));else if(sort==='az')a.sort((p,q)=>p.name.localeCompare(q.name,'pt-BR'));return a}
function selectFeatured(items,roots,rootOf,rank){
 const seen=new Set(),selected=[];
 for(const root of roots){
  const candidates=items.filter(p=>rootOf(p)===root&&!seen.has(p.slug)).sort((a,b)=>rank(a)-rank(b));
  for(const p of candidates.slice(0,2)){if(seen.has(p.slug))continue;seen.add(p.slug);selected.push(p);}
 }
 return selected.sort((a,b)=>rank(a)-rank(b));
}
function isFeaturedView(){return !pageParent&&!fullCatalog&&active==='Todos'&&['search','max-price','color','size'].every(id=>!document.getElementById(id).value.trim())&&document.getElementById('sort').value==='featured'}
function render(){const carousel=isFeaturedView(),allItems=modelsSorted(),items=carousel?selectFeatured(allItems.filter(m=>groupFor(m).some(available)),categoryTree.filter(c=>!c.parent_slug).map(c=>c.slug),m=>categoryKeys(m).root,featuredRank):allItems;
const grid=document.getElementById('grid');grid.classList.toggle('vellor-product-rail',carousel);grid.classList.toggle('vellor-product-grid',!carousel);grid.setAttribute('aria-label',carousel?'Destaques VELLOR, deslize para ver mais':'Todos os produtos encontrados');document.getElementById('vellor-products-prev').hidden=document.getElementById('vellor-products-next').hidden=!carousel;
document.getElementById('count').textContent=`${items.length} ${items.length===1?'modelo':'modelos'}`;renderDiscovery();if(!pageParent)document.querySelector('#colecao h1').textContent=carousel?'Destaques':'Produtos';document.getElementById('vellor-all-products').hidden=!carousel;document.getElementById('size-filter').hidden=['relogios','acessorios'].includes(categoryTree.find(c=>c.slug===active)?.parent_slug||active);document.getElementById('grid').innerHTML=items.length?items.map(m=>{const group=groupFor(m),priced=group.filter(available),display=priced[0]||m,price=priced.length?Math.min(...priced.map(x=>x.price_brl)):null;return `<article class="card"><div class="photo-wrap" style="position:relative">${photo(display)}<button class="hover-quick" data-product-slug="${htmlEsc(m.slug)}">Visualizar produto</button></div><div class="card-meta"><span class="card-category">${htmlEsc(m.category)}</span><h3 class="card-name" data-product-slug="${htmlEsc(m.slug)}">${htmlEsc(m.name)}</h3><div class="card-variants">${group.length} ${group.length===1?'opção':'opções disponíveis'}</div><div class="card-price">${priced.length&&group.length>1?'A partir de ':''}${MONEY(price)}</div><button type="button" class="card-action" data-product-slug="${htmlEsc(m.slug)}">Ver detalhes ⟶</button></div></article>`}).join(''):'<div class="empty"><strong>'+(catalogFailed?'Catálogo temporariamente indisponível':!catalogLoaded?'Carregando catálogo...':'Nenhum produto encontrado')+'</strong>'+(catalogFailed?'Atualize a página para tentar novamente.':!catalogLoaded?'':'Experimente outra categoria ou ajuste os filtros.')+'</div>';document.getElementById('grid').scrollLeft=0;requestAnimationFrame(updateProductNav);save()}
function showProduct(slug,sku){const group=PRODUCTS.filter(p=>p.slug===slug);selected=group.find(p=>p.sku===sku)||group.find(available)||group[0];if(!selected){te('product.selected','PRODUCT_MISSING','Produto indisponivel no catalogo.');return}tr('product.selected',{sku:selected.sku});selectedSize='';renderModal()}
function renderModal(){const p=selected,group=groupFor(p);document.getElementById('detail').innerHTML=`<div class="detail-photo">${photo(p)}</div><div class="detail-info"><button type="button" class="close-btn modal-close" onclick="closeProduct()" aria-label="Fechar">×</button><p class="eyebrow">${htmlEsc(p.category)} · VELLOR</p><h2>${htmlEsc(p.name)}</h2><div class="price">${MONEY(p.price_brl)}</div><label>Escolha a variação</label><div class="variants-list">${group.map(g=>`<button class="variant-pill ${g.sku===p.sku?'active':''}" type="button" data-variant-sku="${htmlEsc(g.sku)}">${htmlEsc(g.variant)}</button>`).join('')}</div>${sizesFor(p).length?`<label for="modal-size">Tamanho</label><select class="size-select" id="modal-size" onchange="selectedSize=this.value;window.VellorTrace?.event('product.size',{sku:selected.sku})"><option value="">Selecione seu tamanho</option>${sizesFor(p).map(s=>`<option value="${htmlEsc(s)}">${htmlEsc(s)}</option>`).join('')}</select>`:''}<div class="modal-actions"><button type="button" class="primary-btn" ${available(p)?'':'disabled'} onclick="addProduct(false)">Adicionar ao carrinho</button><button type="button" class="buy-now" ${available(p)?'':'disabled'} onclick="addProduct(true)">Comprar agora</button></div>${productGallery(p)}${productDisclaimer(p)}<p class="minor-note">Envio em até 3 dias após a confirmação do pagamento. Previsão de entrega: ${htmlEsc(supplierDeadline(p).label)}.</p><p class="sku">SKU: ${htmlEsc(p.sku)}</p></div>`;const modal=document.getElementById('product-modal');modal.classList.add('open');document.body.classList.add('lock')}
function productDisclaimer(p){
 const notes=[];
 if(p.reference_photo){notes.push(p.photo_disclaimer||'Imagem meramente ilustrativa das cores. Confirme a quantidade indicada na descrição da oferta.');}
 if(p.reference){notes.push('Referência estética: '+p.reference+'. Este item não é anunciado como produto da marca citada.');}
 return notes.map(x=>`<p class="minor-note">${htmlEsc(x)}</p>`).join('');
}
function productGallery(p){
  const variants=Array.isArray(galleryMap[p.slug])?galleryMap[p.slug]:[];
  if(!variants.length)return '';
  return `<div class="detail-gallery" aria-label="Fotos adicionais do produto">${variants.map(x=>`<button type="button" title="${htmlEsc(x.label)}" data-gallery-url="${htmlEsc(x.url)}"><img loading="lazy" src="${htmlEsc(x.url)}" alt="${htmlEsc(x.label)}"></button>`).join('')}</div>`;
}
function selectGalleryImage(el,url){const target=document.querySelector('#detail .detail-photo img');if(!target)return;target.src=url;target.parentNode.classList.add('is-loaded');document.querySelectorAll('.detail-gallery button').forEach(b=>b.classList.remove('selected'));el.classList.add('selected')}
function changeVariant(sku){const p=bySku(sku);if(p){selected=p;selectedSize='';tr('product.variant',{sku:p.sku});renderModal()}else te('product.variant','VARIANT_NOT_FOUND','Variacao indisponivel',{sku})}
function closeProduct(){document.getElementById('product-modal').classList.remove('open');document.body.classList.remove('lock')}
function addProduct(buy){const p=selected;if(!available(p)){te('cart.blocked','PRODUCT_NOT_AVAILABLE','Produto indisponivel.');return}const sizes=sizesFor(p).length>0;if(sizes&&!selectedSize){te('cart.blocked','SIZE_REQUIRED','Selecione um tamanho antes de adicionar ao carrinho.',{sku:p.sku});alert('Selecione um tamanho para continuar.');document.getElementById('modal-size')?.focus();return}const existed=cart.find(x=>x.sku===p.sku&&x.size===selectedSize);if(existed){existed.qty=Math.min(existed.qty+1,10)}else cart.push({sku:p.sku,size:selectedSize,qty:1});save();ts('cart.added',{sku:p.sku,quantity:existed?existed.qty:1});closeProduct();openCart();if(buy)goCheckout()}

// Supplier-owned delivery terms. Backend app uses preparation_days,
// delivery_days_min, delivery_days_max; never substitute old catalog estimates.
// The standalone HTML accepts live supplier data by SKU from a future backend adapter.
function supplierTerms(p){
  const live=(window.VELLOR_SUPPLIER_DELIVERY_DATA||{})[p.sku];
  if(live && typeof live==='object')return live;
  return p;
}
function supplierDeadline(p){
  const x=supplierTerms(p);
  const min=Number(x.delivery_days_min),max=Number(x.delivery_days_max);
  const exists=v=>v!==undefined && v!==null && String(v).trim()!=='';
  if(exists(x.delivery_days_min)&&exists(x.delivery_days_max)&&Number.isInteger(min)&&Number.isInteger(max)&&min>=1&&max>=min){
    const prep=exists(x.preparation_days)?Number(x.preparation_days):0;
    const prepDays=Number.isInteger(prep)&&prep>=0?prep:0;
    const from=prepDays+min,to=prepDays+max;
    return {pending:false,label:from===to?`${from} dias úteis`:`${from} a ${to} dias úteis`};
  }
  // The API may already provide the complete [min,max] including preparation.
  if(Array.isArray(x.delivery_days)&&x.delivery_days.length>=2){
    const [a,b]=x.delivery_days.map(Number);
    if(Number.isInteger(a)&&Number.isInteger(b)&&a>=1&&b>=a){
      return {pending:false,label:a===b?`${a} dias úteis`:`${a} a ${b} dias úteis`};
    }
  }
  return {pending:true,label:'Prazo em atualização'};
}
function deliveryIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>'}
function renderCart(){
 if(!catalogLoaded){document.getElementById('cart-list').textContent=catalogFailed?'Catálogo temporariamente indisponível. Atualize a página para recuperar seu carrinho.':'Carregando produtos do carrinho...';document.getElementById('finish-btn').disabled=true;return;}
  cart=cart.filter(i=>i&&typeof i.sku==='string'&&Number.isInteger(i.qty)&&i.qty>0&&i.qty<=10);
  const unavailable=cart.some(i=>!bySku(i.sku));
  let q=0,total=0;
  document.getElementById('cart-list').innerHTML=cart.length?cart.map((c,i)=>{
    const p=bySku(c.sku);if(!p){q+=c.qty;return `<article class="cart-row"><div class="cart-row-product"><div><h3 class="cart-row-name">Produto temporariamente indisponível</h3><p class="cart-row-var">SKU: ${htmlEsc(c.sku)} · ${c.qty} un.</p></div></div><button type="button" class="cart-remove" onclick="removeCartItem(${i})">Remover</button></article>`;}const unit=Number(p.price_brl)||0,lineTotal=unit*c.qty,dl=supplierDeadline(p);
    total+=lineTotal;q+=c.qty;
    const other=c.size?' · Tamanho: '+htmlEsc(c.size):'';
    return `<article class="cart-row" data-sku="${htmlEsc(p.sku)}">
      <div class="cart-row-product">
        <div class="cart-row-image"><img src="${htmlEsc(p.image_url)}" alt="${htmlEsc(p.name)}" onerror="this.remove()" loading="lazy"></div>
        <div><h3 class="cart-row-name">${htmlEsc(p.name)}</h3><p class="cart-row-var">${htmlEsc(p.variant)}${other}<br>SKU: ${htmlEsc(p.sku)}</p>
        <p class="cart-row-delivery ${dl.pending?'pending':''}">${deliveryIcon()}<span><strong>Prazo de entrega:</strong> ${htmlEsc(dl.label)}<br><small>${dl.pending?'Cadastro pendente':'Prazo estimado'}</small></span></p></div>
      </div>
      <div class="cart-row-price"><span class="cart-mobile-label">Valor unitário</span>${MONEY(unit)}</div>
      <div class="cart-quantity-block"><span class="cart-mobile-label">Quantidade</span><div class="cart-qty"><button type="button" aria-label="Diminuir quantidade de ${htmlEsc(p.name)}" onclick="quantity(${i},-1)">−</button><span>${c.qty}</span><button type="button" aria-label="Aumentar quantidade de ${htmlEsc(p.name)}" onclick="quantity(${i},1)">+</button></div><button type="button" class="cart-remove" onclick="removeCartItem(${i})">Remover</button></div>
      <div class="cart-row-total"><span class="cart-mobile-label">Valor total</span>${MONEY(lineTotal)}</div>
    </article>`;
  }).join(''):`<div class="cart-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16l-1 12H5L4 8ZM8 8V6a4 4 0 0 1 8 0v2"/></svg><h2>Seu carrinho está vazio</h2><p>Explore a coleção VELLOR e selecione seus produtos.</p><button type="button" onclick="closeCart()">Ver produtos</button></div>`;
  const noun=q===1?'produto':'produtos';
  document.getElementById('cart-heading-count').textContent=cart.length?`${q} ${noun} ${q===1?'selecionado':'selecionados'}`:'Confira os produtos selecionados.';
  document.getElementById('cart-quantity').textContent=String(q);
  document.getElementById('cart-subtotal').textContent=MONEY(total);
  document.getElementById('cart-total').textContent=MONEY(total);
  document.getElementById('finish-btn').disabled=!cart.length||unavailable;
  save();
  if(unavailable){++quoteSerial;document.getElementById('discount-line').hidden=true;document.getElementById('cart-total').textContent='A confirmar';document.getElementById('coupon-feedback').textContent='Remova os itens indisponíveis ou volte quando estiverem disponíveis.';}else checkQuote();
}
function removeCartItem(n){if(!cart[n])return;const sku=cart[n].sku;cart.splice(n,1);save();tr('cart.removed',{sku});renderCart()}
function quantity(n,d){if(!cart[n])return;const sku=cart[n].sku;cart[n].qty+=d;if(cart[n].qty<=0)cart.splice(n,1);else cart[n].qty=Math.min(cart[n].qty,10);tr('cart.quantity',{sku,quantity:cart.find(x=>x.sku===sku)?.qty||0});save();renderCart()}
function syncCartRoute(){
  const isCart=location.hash==='#carrinho';
  document.getElementById('cart-page').hidden=!isCart;
  renderDiscovery();
  document.body.classList.remove('lock');
  if(isCart)renderCart();
  if(location.hash==='#busca')document.getElementById('search').focus();
  scrollTo({top:0,behavior:'instant'});
}
function openCart(){
  tr('cart.opened',{item_count:cart.length});closeProduct();
  if(location.hash==='#carrinho')syncCartRoute();
  else location.hash='carrinho';
}
function closeCart(){
  if(location.hash==='#carrinho')location.hash='colecao';
  else syncCartRoute();
}

async function goCheckout(){
 if(!catalogLoaded||catalogFailed||cart.some(i=>!bySku(i.sku))){te('cart.blocked','PRODUCT_NOT_AVAILABLE','Há itens indisponíveis.');return}if(!cart.length){te('cart.blocked','EMPTY_CART','Carrinho vazio.');return}tr('checkout.opened',{item_count:cart.length});
 save();
 const button=document.getElementById('finish-btn');
 if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
 try{
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok){te('checkout.auth','AUTH_HTTP_ERROR','Falha ao verificar sessao.',{status:response.status});throw new Error('Não foi possível verificar a sessão.');}
  const session=await response.json();
  if(!session.user){tr('checkout.auth',{status:'login_required'});window.location.assign('/conta?next=%2Ffinalizar');return;}ts('checkout.auth',{status:'authenticated'});
  window.location.assign('/finalizar');
 }catch(e){
  te('checkout.auth','AUTH_CHECK_FAILED',e.message);
  // Se a sessão não puder ser verificada, mostrar primeiro login/cadastro.
  window.location.assign('/conta?next=%2Ffinalizar');
 }finally{
  if(button){button.disabled=false;button.removeAttribute('aria-busy');}
 }
}
function applyCoupon(){coupon=String(document.getElementById('cart-coupon').value||'').trim().toUpperCase().slice(0,70);try{sessionStorage.setItem('pg-goston-cupom',coupon)}catch{}checkQuote()}
function checkQuote(){
 const feedback=document.getElementById('coupon-feedback');
 if(!feedback)return;
 const code=document.getElementById('cart-coupon');
 if(document.activeElement!==code)code.value=coupon;
 const discount=document.getElementById('discount-line');
 if(!cart.length||cart.some(i=>!bySku(i.sku))){++quoteSerial;discount.hidden=true;feedback.textContent=cart.length?'Há itens indisponíveis no carrinho.':'';return}
 const seq=++quoteSerial;
 feedback.textContent='Confirmando os valores...';
 tr('cart.quote.started',{item_count:cart.length});
 fetch('/api/checkout/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart,coupon,trace_id:tid()})})
 .then(async r=>{const x=await r.json();if(!r.ok){te('cart.quote.failed',x.code||'QUOTE_HTTP_ERROR',x.error||'Falha ao validar carrinho.',{status:r.status});throw Error(x.error||'Não foi possível validar o carrinho')}return x.quote})
 .then(q=>{if(seq!==quoteSerial||location.hash!=='#carrinho')return;ts('cart.quote.success',{amount_cents:q.total_cents});
  const price=n=>MONEY(Number(n||0)/100);
  document.getElementById('cart-subtotal').textContent=price(q.subtotal_cents);
  document.getElementById('cart-total').textContent=price(q.total_cents);
  document.getElementById('cart-discount').textContent='− '+price(q.discount_cents);
  discount.hidden=!q.discount_cents;
  feedback.textContent=q.coupon?'Cupom '+q.coupon.code+' aplicado.':'Valores confirmados pelo servidor.';
 }).catch(e=>{if(seq!==quoteSerial||location.hash!=='#carrinho')return;te('cart.quote.failed','QUOTE_UNAVAILABLE',e.message);discount.hidden=true;
  feedback.textContent=coupon?e.message:'Valores finais confirmados na próxima etapa.';
 });
}
function hydrateProducts(incoming){
 if(!Array.isArray(incoming))return;
 // The real database is authoritative; an empty catalog is a valid state.
 catalogLoaded=true;catalogFailed=false;
 PRODUCTS=incoming.map(p=>({...p,image_url:p.image_url||p.image_data||null,
  sizes:Array.isArray(p.sizes)?p.sizes:(p.sizes||''),
  delivery_days:p.delivery_days||null})).filter(available);
 models=[...new Map(PRODUCTS.map(p=>[p.slug,p])).values()];
 save();render();
 if(location.hash==='#carrinho')renderCart();
}

document.getElementById('grid').addEventListener('click',event=>{const trigger=event.target.closest('[data-product-slug]');if(trigger)showProduct(trigger.dataset.productSlug)});
 document.getElementById('detail').addEventListener('click',event=>{const variant=event.target.closest('[data-variant-sku]');if(variant){changeVariant(variant.dataset.variantSku);return}const image=event.target.closest('[data-gallery-url]');if(image)selectGalleryImage(image,image.dataset.galleryUrl)});
 document.getElementById('grid').addEventListener('scroll',updateProductNav,{passive:true});
window.addEventListener('resize',updateProductNav);
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeProduct()});
window.addEventListener('hashchange',syncCartRoute);
try{coupon=sessionStorage.getItem('pg-goston-cupom')||''}catch{}
render();syncCartRoute();

Promise.all([fetch('/api/catalog',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Catálogo indisponível');return r.json()}),fetch('/api/catalog/categories',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([data,cats])=>{if(cats?.hierarchy_ready&&Array.isArray(cats.categories)){categoryTree=cats.categories;categoryTreeReady=true;resolveCategoryRoute();active=pageLeaf||pageParent||'Todos';}if(data&&Array.isArray(data.products)){hydrateProducts(data.products);ts('catalog.loaded',{item_count:data.products.length})}}).catch(e=>{catalogFailed=true;render();if(location.hash==='#carrinho')renderCart();te('catalog.failed','CATALOG_LOAD_FAILED',e.message)});
