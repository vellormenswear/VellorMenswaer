
const CATEGORIES=['Todos','Relógios','Vestuário','Acessórios','Calçados','Vestuário Esportivo'];
let PRODUCTS=JSON.parse(document.getElementById('catalog').textContent);
let models=[...new Map(PRODUCTS.map(p=>[p.slug,p])).values()];
const MONEY=n=>typeof n==='number'?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n):'Preço a confirmar';
const htmlEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let active='Todos',selected=null,selectedSize='',cart=[],galleryMap={},coupon='',quoteSerial=0;
try{const old=JSON.parse(localStorage.getItem('goston-cart-preview')||localStorage.getItem('vellor-modern-preview-cart')||'[]'); if(Array.isArray(old))cart=old;}catch{}
function save(){try{localStorage.setItem('goston-cart-preview',JSON.stringify(cart))}catch{};document.getElementById('cart-count').textContent=cart.reduce((n,x)=>n+x.qty,0)}
function groupFor(p){return PRODUCTS.filter(x=>x.slug===p.slug)}
function sizesFor(p){return Array.isArray(p.sizes)?p.sizes:(typeof p.sizes==='string'?p.sizes.split(',').map(s=>s.trim()).filter(Boolean):[])}
function available(p){return p&&typeof p.price_brl==='number'&&Number.isFinite(p.price_brl)&&p.price_brl>=0&&typeof p.image_url==='string'&&!!p.image_url}
function bySku(sku){return PRODUCTS.find(p=>p.sku===sku)}
function photo(p){return `<div class="photo"><div class="photo-placeholder"><svg viewBox="0 0 50 50"><path d="M25 4 44 25 25 46 6 25 25 4ZM17 25h16M25 17v16"/></svg><span>Imagem do produto indisponível</span></div><img src="${htmlEsc(p.image_url)}" alt="${htmlEsc(p.name)} — ${htmlEsc(p.variant)}" loading="lazy" onload="this.parentNode.classList.add('is-loaded')" onerror="this.remove()"></div>`}
function choose(category,top=false){if(location.hash==='#carrinho'){location.hash='colecao';document.getElementById('catalog-page').hidden=false;document.getElementById('cart-page').hidden=true;}active=category;document.getElementById('search').value='';document.getElementById('color').value='';document.getElementById('size').value='';render();if(!top)document.querySelector('.category-nav').scrollIntoView({behavior:'smooth'});else scrollTo({top:0,behavior:'smooth'})}
function toggleFilters(){const el=document.getElementById('filter-panel'),b=document.getElementById('filter-toggle');const open=el.classList.toggle('open');b.classList.toggle('active',open);b.setAttribute('aria-expanded',open)}
function resetFilters(){['max-price','color','size'].forEach(id=>document.getElementById(id).value='');document.getElementById('search').value='';render()}
function modelsSorted(){let a=models.filter(p=>{const all=groupFor(p),max=document.getElementById('max-price').value,search=normalize(document.getElementById('search').value),color=normalize(document.getElementById('color').value),size=document.getElementById('size').value;
return (active==='Todos'||p.category===active)&&(!search||normalize(p.name+' '+all.map(x=>x.variant+' '+x.sku).join(' ')).includes(search))&&(!color||all.some(x=>normalize(x.variant).includes(color)))&&(!size||all.some(x=>sizesFor(x).includes(size)))&&(!max||all.some(x=>available(x)&&x.price_brl<=Number(max)))});
const sort=document.getElementById('sort').value;
const low=p=>Math.min(...groupFor(p).filter(available).map(x=>x.price_brl),Infinity);
if(sort==='low')a.sort((p,q)=>low(p)-low(q));else if(sort==='high')a.sort((p,q)=>low(q)-low(p));else if(sort==='az')a.sort((p,q)=>p.name.localeCompare(q.name,'pt-BR'));return a}
function render(){document.getElementById('nav').innerHTML=CATEGORIES.map(c=>`<button type="button" class="nav-item ${c===active?'active':''}" aria-current="${c===active?'page':'false'}" data-category="${htmlEsc(c)}">${htmlEsc(c)}</button>`).join('');document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>choose(b.dataset.category));const items=modelsSorted();document.getElementById('count').textContent=`${items.length} ${items.length===1?'modelo':'modelos'}`;document.getElementById('size-filter').hidden=active==='Relógios'||active==='Acessórios';document.getElementById('grid').innerHTML=items.length?items.map(m=>{const group=groupFor(m),priced=group.filter(available),display=priced[0]||m,price=priced.length?Math.min(...priced.map(x=>x.price_brl)):null;return `<article class="card"><div class="photo-wrap" style="position:relative">${photo(display)}<button class="hover-quick" onclick="showProduct('${htmlEsc(m.slug)}')">Visualizar produto</button></div><div class="card-meta"><span class="card-category">${htmlEsc(m.category)}</span><h3 class="card-name" onclick="showProduct('${htmlEsc(m.slug)}')">${htmlEsc(m.name)}</h3><div class="card-variants">${group.length} ${group.length===1?'opção':'opções disponíveis'}</div><div class="card-price">${priced.length&&group.length>1?'A partir de ':''}${MONEY(price)}</div><button type="button" class="card-action" onclick="showProduct('${htmlEsc(m.slug)}')">Ver detalhes ⟶</button></div></article>`}).join(''):'<div class="empty"><strong>Nenhum produto encontrado</strong>Experimente outra categoria ou ajuste os filtros.</div>';save()}
function showProduct(slug,sku){const group=PRODUCTS.filter(p=>p.slug===slug);selected=group.find(p=>p.sku===sku)||group.find(available)||group[0];selectedSize='';renderModal()}
function renderModal(){const p=selected,group=groupFor(p);document.getElementById('detail').innerHTML=`<div class="detail-photo">${photo(p)}</div><div class="detail-info"><button type="button" class="close-btn modal-close" onclick="closeProduct()" aria-label="Fechar">×</button><p class="eyebrow">${htmlEsc(p.category)} · VELLOR</p><h2>${htmlEsc(p.name)}</h2><div class="price">${MONEY(p.price_brl)}</div><label>Escolha a variação</label><div class="variants-list">${group.map(g=>`<button class="variant-pill ${g.sku===p.sku?'active':''}" type="button" onclick="changeVariant('${htmlEsc(g.sku)}')">${htmlEsc(g.variant)}</button>`).join('')}</div>${sizesFor(p).length?`<label for="modal-size">Tamanho</label><select class="size-select" id="modal-size" onchange="selectedSize=this.value"><option value="">Selecione seu tamanho</option>${sizesFor(p).map(s=>`<option value="${htmlEsc(s)}">${htmlEsc(s)}</option>`).join('')}</select>`:''}<div class="modal-actions"><button type="button" class="primary-btn" ${available(p)?'':'disabled'} onclick="addProduct(false)">Adicionar ao carrinho</button><button type="button" class="buy-now" ${available(p)?'':'disabled'} onclick="addProduct(true)">Comprar agora</button></div>${productGallery(p)}${productDisclaimer(p)}<p class="minor-note">Previsão de entrega: ${htmlEsc(supplierDeadline(p).label)}.</p><p class="sku">SKU: ${htmlEsc(p.sku)}</p></div>`;const modal=document.getElementById('product-modal');modal.classList.add('open');document.body.classList.add('lock')}
function productDisclaimer(p){
 const notes=[];
 if(p.reference_photo){notes.push(p.photo_disclaimer||'Imagem meramente ilustrativa das cores. Confirme a quantidade indicada na descrição da oferta.');}
 if(p.reference){notes.push('Referência estética: '+p.reference+'. Este item não é anunciado como produto da marca citada.');}
 return notes.map(x=>`<p class="minor-note">${htmlEsc(x)}</p>`).join('');
}
function productGallery(p){
  const variants=Array.isArray(galleryMap[p.slug])?galleryMap[p.slug]:[];
  if(!variants.length)return '';
  return `<div class="detail-gallery" aria-label="Fotos adicionais do produto">${variants.map(x=>`<button type="button" title="${htmlEsc(x.label)}" onclick="selectGalleryImage(this,'${htmlEsc(x.url)}')"><img loading="lazy" src="${htmlEsc(x.url)}" alt="${htmlEsc(x.label)}"></button>`).join('')}</div>`;
}
function selectGalleryImage(el,url){const target=document.querySelector('#detail .detail-photo img');if(!target)return;target.src=url;target.parentNode.classList.add('is-loaded');document.querySelectorAll('.detail-gallery button').forEach(b=>b.classList.remove('selected'));el.classList.add('selected')}
function changeVariant(sku){const p=bySku(sku);if(p){selected=p;selectedSize='';renderModal()}}
function closeProduct(){document.getElementById('product-modal').classList.remove('open');document.body.classList.remove('lock')}
function addProduct(buy){const p=selected;if(!available(p))return;const sizes=sizesFor(p).length>0;if(sizes&&!selectedSize){alert('Selecione um tamanho para continuar.');document.getElementById('modal-size')?.focus();return}const existed=cart.find(x=>x.sku===p.sku&&x.size===selectedSize);if(existed){existed.qty=Math.min(existed.qty+1,10)}else cart.push({sku:p.sku,size:selectedSize,qty:1});save();closeProduct();openCart();if(buy)goCheckout()}

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
  cart=cart.filter(i=>bySku(i.sku)&&Number.isInteger(i.qty)&&i.qty>0&&i.qty<=10);
  let q=0,total=0;
  document.getElementById('cart-list').innerHTML=cart.length?cart.map((c,i)=>{
    const p=bySku(c.sku),unit=Number(p.price_brl)||0,lineTotal=unit*c.qty,dl=supplierDeadline(p);
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
  document.getElementById('finish-btn').disabled=!cart.length;
  save();
  checkQuote();
}
function removeCartItem(n){if(!cart[n])return;cart.splice(n,1);save();renderCart()}
function quantity(n,d){if(!cart[n])return;cart[n].qty+=d;if(cart[n].qty<=0)cart.splice(n,1);else cart[n].qty=Math.min(cart[n].qty,10);save();renderCart()}
function syncCartRoute(){
  const isCart=location.hash==='#carrinho';
  document.getElementById('catalog-page').hidden=isCart;
  document.getElementById('cart-page').hidden=!isCart;
  document.body.classList.remove('lock');
  if(isCart)renderCart();
  scrollTo({top:0,behavior:'instant'});
}
function openCart(){
  closeProduct();
  if(location.hash==='#carrinho')syncCartRoute();
  else location.hash='carrinho';
}
function closeCart(){
  if(location.hash==='#carrinho')location.hash='colecao';
  else syncCartRoute();
}

async function goCheckout(){
 if(!cart.length)return;
 save();
 const button=document.getElementById('finish-btn');
 if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
 try{
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error('Não foi possível verificar a sessão.');
  const session=await response.json();
  if(!session.user){window.location.assign('/conta?next=%2Ffinalizar');return;}
  window.location.assign('/finalizar');
 }catch(e){
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
 if(!cart.length){discount.hidden=true;feedback.textContent='';return}
 const seq=++quoteSerial;
 feedback.textContent='Confirmando os valores...';
 fetch('/api/checkout/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart,coupon})})
 .then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Não foi possível validar o carrinho');return x.quote})
 .then(q=>{if(seq!==quoteSerial||location.hash!=='#carrinho')return;
  const price=n=>MONEY(Number(n||0)/100);
  document.getElementById('cart-subtotal').textContent=price(q.subtotal_cents);
  document.getElementById('cart-total').textContent=price(q.total_cents);
  document.getElementById('cart-discount').textContent='− '+price(q.discount_cents);
  discount.hidden=!q.discount_cents;
  feedback.textContent=q.coupon?'Cupom '+q.coupon.code+' aplicado.':'Valores confirmados pelo servidor.';
 }).catch(e=>{if(seq!==quoteSerial||location.hash!=='#carrinho')return;discount.hidden=true;
  feedback.textContent=coupon?e.message:'Valores finais confirmados na próxima etapa.';
 });
}
function hydrateProducts(incoming){
 if(!Array.isArray(incoming))return;
 // The real database is authoritative; an empty catalog is a valid state.
 const old=new Map(PRODUCTS.map(p=>[p.sku,p]));
 PRODUCTS=incoming.map(p=>({...old.get(p.sku),...p,image_url:p.image_url||p.image_data||null,
  sizes:Array.isArray(p.sizes)?p.sizes:(p.sizes||''),
  delivery_days:p.delivery_days||null})).filter(available);
 models=[...new Map(PRODUCTS.map(p=>[p.slug,p])).values()];
 cart=cart.filter(x=>bySku(x.sku));save();render();
 if(location.hash==='#carrinho')renderCart();
}

window.addEventListener('keydown',e=>{if(e.key==='Escape')closeProduct()});
window.addEventListener('hashchange',syncCartRoute);
try{coupon=sessionStorage.getItem('pg-goston-cupom')||''}catch{}
render();syncCartRoute();
fetch('/gallery-map.json').then(r=>r.ok?r.json():{}).then(x=>{galleryMap=x||{}}).catch(()=>{});
fetch('/api/catalog',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Catálogo indisponível');return r.json()}).then(data=>{if(data&&Array.isArray(data.products))hydrateProducts(data.products)}).catch(()=>{});

