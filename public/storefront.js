/* Vellor Menswear: vitrine aprovada, conectada às APIs reais. Sem pedidos locais fictícios. */
const catalog = JSON.parse(document.getElementById('catalog-json').textContent);
const cats = ['Todos','Relógios','Vestuário','Vestuário Esportivo','Acessórios','Calçados'];
const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0));
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const formattedSizes = p => Array.isArray(p.sizes) ? p.sizes : typeof p.sizes==='string' ? p.sizes.split(',').map(x=>x.trim()).filter(Boolean) : [];
const photoOk = p => p.shipping==='nacional' && typeof p.price_brl==='number' && Number.isFinite(p.price_brl) && p.price_brl>=0 && typeof p.image_data==='string' && (p.image_data.startsWith('/') || p.image_data.startsWith('https://')) && p.active!==false && !p.hidden;
const visible = () => catalog.filter(photoOk);
const lookup = sku => visible().find(p=>p.sku===sku);
const photograph = (p,css='') => `<img ${css?'class="'+esc(css)+'"':''} loading="lazy" decoding="async" src="${esc(p.image_data)}" alt="${esc(p.name)} — ${esc(p.variant)}"/>`;
let cat='Todos',cart=[],current=null,galleries={},coupon='',quoteRequest=0;
try{cart=JSON.parse(localStorage.getItem('goston-cart-preview')||'[]');if(!Array.isArray(cart))cart=[];}catch{cart=[];}
try{coupon=sessionStorage.getItem('pg-goston-cupom')||''}catch{}
const grid=document.getElementById('grid');
function store(){try{localStorage.setItem('goston-cart-preview',JSON.stringify(cart))}catch{}document.getElementById('bagcount').textContent=cart.reduce((sum,i)=>sum+(i.qty||0),0)}
function choose(x){cat=cats.includes(x)?x:'Todos';render();document.getElementById('catalogo').scrollIntoView({behavior:'smooth'})}
function render(){
 const menu=document.getElementById('cats');menu.innerHTML=cats.map(c=>`<button class="${cat===c?'active':''}" data-category="${esc(c)}">${esc(c)}</button>`).join('');
 menu.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>choose(b.dataset.category));
 const query=norm(document.getElementById('query').value||'');let items=visible().filter(p=>(cat==='Todos'||p.category===cat)&&norm([p.name,p.variant,p.sku].join(' ')).includes(query));
 const sort=document.getElementById('sort').value;
 if(sort==='asc')items.sort((a,b)=>a.price_brl-b.price_brl);
 if(sort==='desc')items.sort((a,b)=>b.price_brl-a.price_brl);
 document.getElementById('count').textContent=`${items.length} produtos encontrados`;
 grid.innerHTML=items.map(p=>`<article class="card" role="button" tabindex="0" data-sku="${esc(p.sku)}"><div class="card-photo">${photograph(p)}</div><div class="ci"><small>${esc(p.category)}</small><h3>${esc(p.name)}</h3><p>${esc(p.variant)}</p>${p.reference_photo?`<p class="subtle">${esc(p.quantity)} unidade(s) · foto de referência das cores</p>`:""}<strong>${money(p.price_brl)}</strong>${typeof p.base_price_brl==='number'&&p.base_price_brl>p.price_brl?`<span class="was">De ${money(p.base_price_brl)}</span>`:''}<div class="a">VER PRODUTO</div></div></article>`).join('')||'<div class="empty">Nenhum produto encontrado para esta busca.</div>';
 grid.querySelectorAll('[data-sku]').forEach(el=>{el.onclick=()=>show(el.dataset.sku);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show(el.dataset.sku)}}});
 store();
}
function galleryFor(p){const options=galleries[p.slug]||[];const variant=norm(p.variant);
 return options.filter(x=>{const name=norm(x.label);if(name.includes('tamanhos'))return true;
 if(p.slug.includes('estojo'))return variant.includes('12')?name.includes('12'):name.includes('6');
 if(p.slug.includes('fosco-verniz'))return variant.includes('fosco')?name==='fosco':name==='verniz';
 if(p.slug.includes('sem-cadarco'))return variant.includes('azul')?name==='azul_marinho':name==='preto';
 if(p.slug.includes('minimalista')){if(variant==='branco')return ['branco','branco_lateral'].includes(name);if(variant.includes('branco com preto'))return name==='branco_preto';if(variant==='preto')return name==='preto';if(variant.includes('preto com branco'))return name==='preto_branco';}
 return true;});
}
function show(sku){current=lookup(sku);if(!current)return;const p=current;const sizes=formattedSizes(p);
 const choices=sizes.length?`<label for="size">Tamanho</label><select id="size"><option value="">Selecione</option>${sizes.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>`:'';
 const alt=visible().filter(x=>x.slug===p.slug&&x.sku!==p.sku);
 const fmtDays=Array.isArray(p.delivery_days)&&p.delivery_days.length===2?p.delivery_days.join(' a ')+' dias úteis':'A confirmar';
 const spec=`<div class="spec-list"><div class="spec-row"><span>Código</span><b>${esc(p.sku)}</b></div><div class="spec-row"><span>Prazo de entrega</span><b>${esc(fmtDays)}</b></div>${p.material?`<div class="spec-row"><span>Material informado</span><b>${esc(p.material)}</b></div>`:''}</div>`;
 const brandRef=p.reference?`<p class="brand-disclaimer">Referência visual: ${esc(p.reference)}. O produto anunciado não é apresentado como fabricado pela marca de referência.</p>`:'';
 const thumbs=galleryFor(p).map(x=>`<button class="pg-gallery-choice" type="button" data-gallery-url="${esc(x.url)}" title="${esc(x.label)}"><img loading="lazy" src="${esc(x.url)}" alt="${esc(x.label)}"/></button>`).join('');
 document.getElementById('modal').innerHTML=`<button class="close" onclick="hideModal()" aria-label="Fechar">✕</button><div class="modal-photo">${photograph(p)}</div><div class="modal-content"><small>${esc(p.category)} · VELLOR MENSWEAR</small><h2>${esc(p.name)}</h2><p>Cor / variação: <b>${esc(p.variant)}</b></p><div class="modal-price">${money(p.price_brl)}</div>${typeof p.base_price_brl==='number'&&p.base_price_brl>p.price_brl?`<span class="strike">Preço original: ${money(p.base_price_brl)}</span>`:''}${choices}<button class="goldbtn full" onclick="addBag()">ADICIONAR AO CARRINHO</button>${alt.length?`<p>Outras versões deste modelo:</p><div class="variant-group">${alt.map(x=>`<button class="variant-btn" data-variant-sku="${esc(x.sku)}">${esc(x.variant)}</button>`).join('')}</div>`:''}${p.notice?`<p class="subtle">${esc(p.notice)}</p>`:''}${spec}${brandRef}${thumbs?'<p>Imagens do produto</p><div class="pg-gallery">'+thumbs+'</div>':''}</div>`;
 document.querySelectorAll('[data-variant-sku]').forEach(el=>el.onclick=()=>show(el.dataset.variantSku));
 document.querySelectorAll('[data-gallery-url]').forEach(el=>el.onclick=()=>{const photo=document.querySelector('#modal .modal-photo img');if(photo){photo.src=el.dataset.galleryUrl;photo.alt=el.title}});
 document.getElementById('shade').classList.add('open');document.body.style.overflow='hidden';
}
function hideModal(){document.getElementById('shade').classList.remove('open');document.body.style.overflow=''}
function addBag(){if(!current||!photoOk(current))return;const size=document.getElementById('size')?.value||'';if(formattedSizes(current).length&&!size){alert('Selecione o tamanho.');return}
 const item=cart.find(i=>i.sku===current.sku&&i.size===size);if(item){if(item.qty>=10){alert('Limite de 10 unidades por item.');return}item.qty++;}else cart.push({sku:current.sku,size,qty:1});store();hideModal();openBag();}
function changeQty(index,delta){const i=cart[index];if(!i)return;i.qty=Math.min(10,(i.qty||0)+delta);if(i.qty<=0)cart.splice(index,1);store();openBag()}
function closeBag(){document.getElementById('side').classList.remove('open');document.body.style.overflow=''}
function goCheckout(){if(!cart.length)return;store();window.location.assign('/finalizar')}
function applyCoupon(){const c=String(document.getElementById('pg-coupon')?.value||'').trim().toUpperCase().slice(0,70);coupon=c;try{sessionStorage.setItem('pg-goston-cupom',c)}catch{}openBag()}
function openBag(){
 store();document.getElementById('side').classList.add('open');document.body.style.overflow='hidden';
 cart=cart.filter(i=>lookup(i.sku)&&Number.isInteger(i.qty)&&i.qty>0&&i.qty<=10);store();
 const rows=cart.map((i,k)=>{const p=lookup(i.sku);return `<div class="basket-row"><div style="width:66px;height:78px;flex-shrink:0">${photograph(p)}</div><div><b>${esc(p.name)}</b><p>${esc(p.variant)}${i.size?' · '+esc(i.size):''}</p><p>${i.qty} × ${money(p.price_brl)}</p><button class="remove" onclick="changeQty(${k},-1)">− Retirar 1</button> · <button class="remove" onclick="changeQty(${k},1)">+ Adicionar 1</button></div></div>`}).join('');
 document.getElementById('baglist').innerHTML=rows||'<p>Seu carrinho está vazio.</p>';
 const total=document.getElementById('total');const btn=document.getElementById('checkout-btn');btn.disabled=!cart.length;
 let extra=document.getElementById('bagextras');if(!extra){extra=document.createElement('div');extra.id='bagextras';btn.insertAdjacentElement('beforebegin',extra)}
 if(!cart.length){total.textContent='';extra.innerHTML='';return}
 total.textContent='Validando os valores...';
 extra.innerHTML=`<div class="coupon-wrap"><label class="subtle" for="pg-coupon">Cupom de desconto</label><div><input id="pg-coupon" placeholder="Código" value="${esc(coupon)}"/><button onclick="applyCoupon()">Aplicar</button></div><p id="pg-coupon-note" class="subtle"></p></div>`;
 const seq=++quoteRequest;
 fetch('/api/checkout/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart,coupon})}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Não foi possível consultar os valores');return x}).then(x=>{if(seq!==quoteRequest)return;let q=x.quote;total.textContent=`Subtotal ${money(q.subtotal_cents/100)} · Desconto ${money(q.discount_cents/100)} · Frete ${q.shipping_cents===null?'a calcular':money(q.shipping_cents/100)}`;document.getElementById('pg-coupon-note').textContent=q.coupon?'Cupom '+q.coupon.code+' aplicado.':'Valores calculados e validados pelo servidor.';}).catch(()=>{if(seq!==quoteRequest)return;total.textContent='O valor final será confirmado no checkout.';document.getElementById('pg-coupon-note').textContent='Consulte o desconto e o frete ao finalizar.';});
}
window.addEventListener('keydown',e=>{if(e.key==='Escape'){hideModal();closeBag()}});
render();

fetch('/api/catalog',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{
 if(!data || !Array.isArray(data.products))return;
 const olds=new Map(catalog.map(x=>[x.sku,x]));
 const merged=data.products.map(p=>({...olds.get(p.sku),...p,image_data:p.image_url||null})).filter(photoOk);
 catalog.splice(0,catalog.length,...merged);
 cart=cart.filter(i=>lookup(i.sku));render();
}).catch(()=>{});
