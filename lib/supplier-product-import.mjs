import {combinationKey,parseReportedStock} from './variant-grid.mjs';
const plain=(v,max)=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const type=(x,t)=>[].concat(x?.['@type']||[]).some(v=>typeof v==='string'&&v.split(/[\/#]/).at(-1)===t);
const array=v=>v==null?[]:Array.isArray(v)?v:[v];
function image(v,base){try{const raw=typeof v==='string'?v:v?.contentUrl||v?.url;if(typeof raw!=='string'||!raw.trim())return '';const u=new URL(raw,base);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2048?u.href:''}catch{return ''}}
function availability(v){const raw=typeof v==='string'?v.split(/[\/#]/).at(-1):'';return raw==='InStock'||raw==='LimitedAvailability'?true:raw==='OutOfStock'||raw==='SoldOut'||raw==='Discontinued'?false:null}
function observedStock(o){const q=o?.inventoryLevel;try{return q&&typeof q==='object'&&!Array.isArray(q)&&q.value!=null?parseReportedStock(q.value):null}catch{return null}}
function values(v){const offers=array(v.offers).filter(o=>type(o,'Offer'));if(offers.length!==1)return {supplier_available:null,reported_stock:null};const o=offers[0];return {supplier_available:availability(o.availability),reported_stock:observedStock(o)}}
export function parseSupplierProduct(html,base){
 const nodes=[];
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(!/\btype\s*=\s*["']application\/ld\+json["']/i.test(m[1]))continue;
  try{const j=JSON.parse(m[2]);for(const n of array(j)){if(n&&typeof n==='object'){nodes.push(n,...array(n['@graph']));}}}catch{}
 }
 const groups=nodes.filter(n=>type(n,'ProductGroup'));
 const products=nodes.filter(n=>type(n,'Product'));
 const parent=groups.length===1?groups[0]:groups.length===0&&products.length===1?products[0]:null;
 if(!parent)throw Error('Não foi possível identificar um único produto nesta página.');
 const children=type(parent,'ProductGroup')?array(parent.hasVariant).map(v=>v?.['@id']&&!type(v,'Product')?nodes.find(n=>n?.['@id']===v['@id']&&type(n,'Product')):v).filter(v=>type(v,'Product')):[parent];
 const rows=[],seen=new Set();let incomplete=false;
 for(const v of children){
  const label=plain(v.color||parent.color,120),size=plain(v.size||parent.size,30);
  // A missing combination must be completed manually; never invent a color or size.
  if(children.length>1&&(!label||!size)){incomplete=true;continue;}
  const k=combinationKey(label,size);if(seen.has(k))throw Error('A página apresenta combinações ambíguas de cor e tamanho.');seen.add(k);
  rows.push({label,sizes:size?[size]:[],image_url:array(v.image).map(x=>image(x,base)).find(Boolean)||'',...values(v)});
 }
 if(rows.length>120)throw Error('O anúncio excede o limite de variações do cadastro.');
 return {name:plain(parent.name,220),description:plain(parent.description,4000),category:plain(parent.category,200),photos:[...new Set(array(parent.image).map(x=>image(x,base)).filter(Boolean))].slice(0,30),variants:incomplete?[]:rows,variants_incomplete:incomplete||children.length===0};
}
