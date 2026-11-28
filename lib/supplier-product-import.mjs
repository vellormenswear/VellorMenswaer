import {importError} from './supplier-import-errors.mjs';
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
 return {name:plain(parent.name,220),description:plain(parent.description,4000),category:plain(parent.category,200),photos:[...new Set(array(parent.image).map(x=>image(x,base)).filter(Boolean))].slice(0,30),variants:incomplete?[]:rows,variants_incomplete:incomplete||children.length===0};
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
 try{
  const p=structuredProduct(html,base),m=productMetadata(html,base);
  if(m){p.name=p.name||m.name;p.description=p.description||m.description;p.category=p.category||m.category;p.photos=p.photos.length?p.photos:m.photos;}
  return p;
 }catch(e){
  if(e?.code!=='NO_STRUCTURED_PRODUCT')throw e;
  const m=productMetadata(html,base);if(m)return m;
  throw importError('NO_PRODUCT_DATA','O anúncio não disponibilizou dados de produto reconhecíveis. Pode depender de JavaScript ou exigir acesso autorizado.');
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
 if(p.variants.length>120||!p.variants.length||color.length!==1||size.length!==1||options.length!==2||color[0].position===size[0].position||![1,2].includes(color[0].position)||![1,2].includes(size[0].position))return result;
 const seen=new Set(),rows=[];
 for(const v of p.variants){
  const opt=i=>Array.isArray(v.options)?v.options[i-1]:v['option'+i];
  const label=plain(opt(color[0].position),120),s=plain(opt(size[0].position),30),key=combinationKey(label,s);
  if(!label||!s||seen.has(key))return result;seen.add(key);
  // The documented Ajax API exposes availability, not exact inventory quantity.
  rows.push({label,sizes:[s],image_url:image(v.featured_image?.src||v.featured_image,base),supplier_available:typeof v.available==='boolean'?v.available:null,reported_stock:null});
 }
 return {...result,variants:rows,variants_incomplete:false};
}
export function combineShopifyProduct(primary,shop){
 if(!primary)return shop;
 const existing=new Map(primary.variants.map(v=>[combinationKey(v.label,v.sizes?.[0]),v]));
 if(shop.variants_incomplete)return {...primary,name:primary.name||shop.name,description:primary.description||shop.description,category:primary.category||shop.category,photos:primary.photos.length?primary.photos:shop.photos};
 return {...primary,name:primary.name||shop.name,description:primary.description||shop.description,category:primary.category||shop.category,photos:[...new Set([...primary.photos,...shop.photos])].slice(0,30),variants:shop.variants.map(v=>{const old=existing.get(combinationKey(v.label,v.sizes[0]));return {...v,image_url:v.image_url||old?.image_url||'',reported_stock:old?.reported_stock??null,supplier_available:v.supplier_available??old?.supplier_available??null}}),variants_incomplete:false};
}
