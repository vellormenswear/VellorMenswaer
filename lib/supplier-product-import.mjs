import {importError} from './supplier-import-errors.mjs';
import {extractProductPageImages} from './supplier-page-images.mjs';
import {combinationKey,parseReportedStock} from './variant-grid.mjs';
const decode=v=>v.replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d{1,7}|#x[0-9a-f]{1,6});/gi,m=>{const key=m.slice(1,-1).toLowerCase();const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};if(Object.hasOwn(named,key))return named[key];const n=key.startsWith('#x')?parseInt(key.slice(2),16):Number(key.slice(1));return Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):m;});
const plain=(v,max)=>typeof v==='string'?decode(v.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim().slice(0,max):'';
const type=(x,t)=>[].concat(x?.['@type']||[]).some(v=>typeof v==='string'&&v.split(/[\/#]/).at(-1)===t);
const array=v=>v==null?[]:Array.isArray(v)?v:[v];
function image(v,base){try{const raw=typeof v==='string'?v:v?.contentUrl||v?.url;if(typeof raw!=='string'||!raw.trim())return '';const u=new URL(raw,base);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=1000?u.href:''}catch{return ''}}
function availability(v){const raw=typeof v==='string'?v.split(/[\/#]/).at(-1):'';return raw==='InStock'||raw==='LimitedAvailability'?true:raw==='OutOfStock'||raw==='SoldOut'||raw==='Discontinued'?false:null}
function observedStock(o){const q=o?.inventoryLevel;try{return q&&typeof q==='object'&&!Array.isArray(q)&&q.value!=null?parseReportedStock(q.value):null}catch{return null}}
function values(v){const offers=array(v.offers).filter(o=>type(o,'Offer'));if(offers.length!==1)return {supplier_available:null,reported_stock:null};const o=offers[0];return {supplier_available:availability(o.availability),reported_stock:observedStock(o)}}
function structuredProduct(html,base){
 const nodes=[];
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(!/\btype\s*=\s*["']application\/ld\+json["']/i.test(m[1]))continue;
  try{const j=JSON.parse(m[2]);for(const n of array(j)){if(n&&typeof n==='object'){nodes.push(n,...array(n['@graph']));}}}catch{}
 }
 const groups=nodes.filter(n=>type(n,'ProductGroup'));
 const products=nodes.filter(n=>type(n,'Product'));
 const parent=groups.length===1?groups[0]:groups.length===0&&products.length===1?products[0]:null;
 if(!parent)throw importError('NO_STRUCTURED_PRODUCT','Não foi possível identificar um único produto nesta página.');
 const children=type(parent,'ProductGroup')?array(parent.hasVariant).map(v=>v?.['@id']&&!type(v,'Product')?nodes.find(n=>n?.['@id']===v['@id']&&type(n,'Product')):v).filter(v=>type(v,'Product')):[parent];
 const rows=[],seen=new Set();let incomplete=false;
 for(const v of children){
  const label=plain(v.color||parent.color,120),size=plain(v.size||parent.size,30);
  // A missing combination must be completed manually; never invent a color or size.
  if(type(parent,'ProductGroup')&&(!label||!size)){incomplete=true;continue;}
  const k=combinationKey(label,size);if(seen.has(k))throw importError('AMBIGUOUS_VARIANTS','A página apresenta combinações ambíguas de cor e tamanho.');seen.add(k);
  rows.push({label,sizes:size?[size]:[],image_url:array(v.image).map(x=>image(x,base)).find(Boolean)||'',...values(v)});
 }
 if(rows.length>120)throw importError('VARIANT_LIMIT','O anúncio excede o limite de variações do cadastro.');
 return {name:plain(parent.name,220),description:plain(parent.description,4000),category:plain(parent.category,200),photos:[...new Set(array(parent.image).map(x=>image(x,base)).filter(Boolean))].slice(0,30),variants:incomplete?[]:rows,variants_incomplete:incomplete||children.length===0||rows.some(v=>!v.label||v.sizes.length!==1)};
}

function attributes(tag){
 const a={};for(const m of tag.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)){const key=m[1].toLowerCase();if(!Object.hasOwn(a,key)&&key!=='__proto__')a[key]=decode(m[2]??m[3]??m[4]);}return a;
}
function productMetadata(html,base){
 // Read only actual head metadata. Never import a site's generic title as a product.
 const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1]||'';
 const meta=new Map();
 for(const m of head.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'').matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)){
  const a=attributes(m[0]),key=(a.property||a.name||'').toLowerCase();
  if(key&&a.content){if(!meta.has(key))meta.set(key,[]);meta.get(key).push(a.content);}
 }
 const first=k=>meta.get(k)?.[0]||'';
 if(!['product','product.item'].includes(first('og:type').toLowerCase())||!first('og:title'))return null;
 return {name:plain(first('og:title'),220),description:plain(first('og:description')||first('description'),4000),category:plain(first('product:category'),200),photos:[...new Set((meta.get('og:image')||[]).map(x=>image(x,base)).filter(Boolean))].slice(0,30),variants:[],variants_incomplete:true};
}
export function parseSupplierProduct(html,base){
 const page=extractProductPageImages(html,base);
 const metadata=productMetadata(html,base);
 const enrich=p=>{
  const normalize=v=>String(v||'').normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
  if(page.identified&&page.name&&normalize(p.name)===normalize(page.name)){
   p.photos=[...new Set([...p.photos,...page.photos])].slice(0,30);
   p.description=p.description||page.description;p.category=p.category||page.category;
  }
  return p;
 };
 try{
  const p=structuredProduct(html,base),m=metadata;
  if(m){p.name=p.name||m.name;p.description=p.description||m.description;p.category=p.category||m.category;p.photos=p.photos.length?p.photos:m.photos;}
  return enrich(p);
 }catch(e){
  if(e?.code!=='NO_STRUCTURED_PRODUCT')throw e;
  if(metadata)return enrich(metadata);
  if(page.identified&&page.name)return {name:page.name,description:page.description,category:page.category,photos:page.photos,variants:[],variants_incomplete:true};
  throw importError('NO_PRODUCT_DATA','O HTML recebido não contém dados de produto reconhecidos pelo importador. Não foi confirmado bloqueio de acesso.');
 }
}
export function shopifyProductEndpoint(html,base){
 // Only use the documented public Ajax endpoint when the page identifies Shopify.
 if(!/(?:Shopify\.shop\s*=|cdn\.shopify\.com\/|shopify-section)/i.test(html))return null;
 const u=new URL(base),m=u.pathname.match(/^(.*\/products\/)([^/]+)\/?$/i);if(!m||!m[2]||m[2].endsWith('.js'))return null;
 u.pathname=m[1]+m[2]+'.js';u.search='';u.hash='';return u.href;
}
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function parseShopifyProduct(json,endpoint,base){
 let p;try{p=JSON.parse(json)}catch{throw importError('INVALID_JSON','O fornecedor retornou dados de produto inválidos.')}
 const handle=decodeURIComponent(new URL(endpoint).pathname.split('/').at(-1).slice(0,-3));
 if(!p||typeof p!=='object'||typeof p.title!=='string'||typeof p.handle!=='string'||p.handle!==handle||!Array.isArray(p.variants)||!Array.isArray(p.options))throw importError('SHOPIFY_PRODUCT_MISMATCH','A resposta da loja não corresponde ao anúncio consultado.');
 const options=p.options.map((o,i)=>({name:norm(typeof o==='string'?o:o?.name),position:typeof o==='object'?Number(o.position??i+1):i+1}));
 const color=options.filter(o=>['cor','cores','color','colour','modelo','model'].includes(o.name)),size=options.filter(o=>['tamanho','tamanhos','size','sizes','numeracao','numero'].includes(o.name));
 const photos=[...new Set(array(p.images).map(x=>image(x,base)).filter(Boolean))].slice(0,30);
 const result={name:plain(p.title,220),description:plain(p.description,4000),category:plain(p.type,200),photos,variants:[],variants_incomplete:true};
 if(p.variants.length>120||!p.variants.length||color.length>1||size.length>1||options.length!==color.length+size.length||!options.length||new Set(options.map(o=>o.position)).size!==options.length||options.some(o=>!Number.isInteger(o.position)||o.position<1||o.position>options.length))return result;
 const seen=new Set(),rows=[];
 for(const v of p.variants){
  const opt=i=>Array.isArray(v.options)?v.options[i-1]:v['option'+i];
  const label=color.length?plain(opt(color[0].position),120):'',s=size.length?plain(opt(size[0].position),30):'',key=combinationKey(label,s);
  if(color.length&&!label||size.length&&!s||seen.has(key))return result;seen.add(key);
  // The documented Ajax API exposes availability, not exact inventory quantity.
  rows.push({label,sizes:s?[s]:[],image_url:image(v.featured_image?.src||v.featured_image,base),supplier_available:typeof v.available==='boolean'?v.available:null,reported_stock:null});
 }
 return {...result,variants:rows,variants_incomplete:!color.length||!size.length};
}
export function combineShopifyProduct(primary,shop){
 if(!primary)return shop;
 const existing=new Map(primary.variants.map(v=>[combinationKey(v.label,v.sizes?.[0]),v]));
 if(shop.variants_incomplete){const complete=primary.variants.some(v=>v.label&&v.sizes?.length===1)&&!primary.variants_incomplete;return {...primary,name:primary.name||shop.name,description:primary.description||shop.description,category:primary.category||shop.category,photos:primary.photos.length?primary.photos:shop.photos,...(!complete&&shop.variants.length?{variants:shop.variants,variants_incomplete:true}:{})};}
 return {...primary,name:primary.name||shop.name,description:primary.description||shop.description,category:primary.category||shop.category,photos:[...new Set([...primary.photos,...shop.photos])].slice(0,30),variants:shop.variants.map(v=>{const old=existing.get(combinationKey(v.label,v.sizes[0]));return {...v,image_url:v.image_url||old?.image_url||'',reported_stock:old?.reported_stock??null,supplier_available:v.supplier_available??old?.supplier_available??null}}),variants_incomplete:false};
}

export function marketplaceSource(url){
 const h=new URL(url).hostname.toLowerCase();
 if(h==='mercadolivre.com.br'||h.endsWith('.mercadolivre.com.br')||h==='meli.la')return 'mercado_livre';
 if(h==='shopee.com.br'||h.endsWith('.shopee.com.br')||h==='shope.ee')return 'shopee';
 return null;
}
export function publicMarketplaceProduct(product,source){
 if(!source)return product;
 // Public marketplace counts are not a verified seller inventory. Never publish them as exact.
 return {...product,variants:product.variants.map(v=>({...v,reported_stock:null}))};
}
export function wooProductEndpoint(html,base){
 // Use only a public WooCommerce Store API, with a unique product permalink to verify identity.
 if(!/(?:woocommerce|wc-blocks|wc-add-to-cart)/i.test(html))return null;
 const u=new URL(base),m=u.pathname.match(/^(.*)\/(?:product|produto)\/([^/]+)\/?$/i);if(!m)return null;
 const target=new URL(m[1]+'/wp-json/wc/store/v1/products',u.origin);
 target.searchParams.set('slug',decodeURIComponent(m[2]));return target.href;
}
const samePermalink=(a,b)=>{try{const x=new URL(a),y=new URL(b);return x.origin===y.origin&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'')}catch{return false}};
export function parseWooProduct(json,base){
 let rows;try{rows=JSON.parse(json)}catch{throw importError('INVALID_JSON','O fornecedor retornou dados de produto inválidos.')}
 if(!Array.isArray(rows)||rows.length!==1||!samePermalink(rows[0]?.permalink,base)||typeof rows[0]?.name!=='string'||!Number.isSafeInteger(rows[0]?.id)||rows[0].id<=0)throw importError('WOO_PRODUCT_MISMATCH','A resposta da loja não corresponde ao anúncio consultado.');
 const p=rows[0];
 return {productId:p.id,product:{name:plain(p.name,220),description:plain(p.description||p.short_description,4000),category:plain(p.categories?.length===1?p.categories[0].name:'',200),photos:[...new Set(array(p.images).map(x=>image(x?.src,base)).filter(Boolean))].slice(0,30),variants:[],variants_incomplete:true}};
}
export function wooVariationRows(html,base,productId){
 if(!Number.isSafeInteger(productId)||productId<=0)return [];
 const forms=[];
 for(const m of html.matchAll(/<form\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)){
  const a=attributes(m[0]);if(!String(a.class||'').split(/\s+/).includes('variations_form')||Number(a['data-product_id'])!==productId||!a['data-product_variations'])continue;
  try{const rows=JSON.parse(a['data-product_variations']);if(Array.isArray(rows)&&rows.length)forms.push(rows);}catch{}
 }
 if(forms.length!==1||forms[0].length>120)return [];
 const seen=new Set(),rows=[];
 for(const v of forms[0]){
  if(!v.attributes||typeof v.attributes!=='object'||Array.isArray(v.attributes))return [];
  const fields=Object.entries(v.attributes),colors=fields.filter(([k])=>/^attribute_(?:pa_)?(?:cor|color|colour|modelo|model)$/i.test(k)),sizes=fields.filter(([k])=>/^attribute_(?:pa_)?(?:tamanho|size|numeracao|numero)$/i.test(k));
  if(fields.length!==2||colors.length!==1||sizes.length!==1)return [];
  const label=plain(colors[0][1],120),size=plain(sizes[0][1],30);
  // Woo values can be slugs: do not turn them into guessed labels.
  if(!label||!size)return [];
  const key=combinationKey(label,size);if(seen.has(key))return [];seen.add(key);
  rows.push({label,sizes:[size],image_url:image(v.image?.src,base),supplier_available:typeof v.is_in_stock==='boolean'?v.is_in_stock:null,reported_stock:null});
 }
 return rows;
}
