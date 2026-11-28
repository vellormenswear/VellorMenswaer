import {importError} from './supplier-import-errors.mjs';
import {supplierUrl} from './supplier-public-fetch.mjs';
import {combinationKey} from './variant-grid.mjs';

// Read-only alternative to HTML/CDP. Never retry a refused request using
// a different identity or undocumented endpoint. Credentials are caller supplied.
export function marketplaceListingId(raw){
 const u=supplierUrl(raw),h=u.hostname;
 if(h==='mercadolivre.com.br'||h.endsWith('.mercadolivre.com.br')){
  const m=u.pathname.match(/(?:^|\/)MLB-?(\d{5,20})(?:[-/]|$)/i);
  if(m)return {source:'mercado_livre',itemId:'MLB'+m[1],url:u.href};
 }
 if(h==='shopee.com.br'||h.endsWith('.shopee.com.br')){
  const m=u.pathname.match(/(?:-i\.|\/product\/)(\d{1,20})[./](\d{1,20})(?:\/|$)/);
  if(m)return {source:'shopee',shopId:m[1],itemId:m[2],url:u.href};
 }
 throw importError('UNSUPPORTED_LISTING_ID','Não foi possível identificar o anúncio pelo link.');
}
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
function photo(raw){try{const u=supplierUrl(raw);return u.href.length<=1000?u.href:''}catch{return '';}}
export function normalizeMeliItem(listing,item,description){
 if(item?.id!==listing.itemId||!clean(item.title,220))throw importError('API_PRODUCT_MISMATCH','A API não retornou o anúncio solicitado.');
 const pics=Array.isArray(item.pictures)?item.pictures:[],photos=[...new Set(pics.map(x=>photo(x?.secure_url)).filter(Boolean))].slice(0,30);
 const p={name:clean(item.title,220),description:clean(description?.plain_text,4000),category:'',photos,variants:[],variants_incomplete:true};
 // The public item quantity is referential. Never claim exact stock.
 // Import combinations only when both axes and each pairing are explicit.
 if(!Array.isArray(item.variations)||!item.variations.length||item.variations.length>120)return p;
 const seen=new Set(),rows=[];
 for(const v of item.variations){
  if(!Array.isArray(v.attribute_combinations))return p;
  const colors=v.attribute_combinations.filter(x=>x.id==='COLOR'),sizes=v.attribute_combinations.filter(x=>x.id==='SIZE');
  if(colors.length!==1||sizes.length!==1||v.attribute_combinations.length!==2)return p;
  const label=clean(colors[0].value_name,120),size=clean(sizes[0].value_name,30),key=combinationKey(label,size);
  if(!label||!size||seen.has(key))return p;seen.add(key);
  const image_url=photo(pics.find(x=>v.picture_ids?.includes(x.id))?.secure_url);
  // Preserve uncertainty. Do not update stock or availability from public counts.
  rows.push({label,sizes:[size],image_url,supplier_available:null,reported_stock:null});
 }
 return {...p,variants:rows,variants_incomplete:false};
}
export async function readAuthorizedMeli(raw,{accessToken,fetchImpl=fetch}={}){
 const listing=marketplaceListingId(raw);
 if(listing.source!=='mercado_livre')throw importError('API_NOT_CONFIGURED','A consulta oficial desta plataforma ainda não está configurada.');
 if(typeof accessToken!=='string'||!accessToken.trim()||/[\r\n]/.test(accessToken))throw importError('API_AUTH_REQUIRED','A consulta oficial requer credencial de acesso autorizada.');
 const signal=AbortSignal.timeout(10000);
 async function get(path){
  const r=await fetchImpl('https://api.mercadolibre.com/items/'+listing.itemId+path,{method:'GET',headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'},redirect:'error',signal,cache:'no-store'});
  if(!r.ok)throw importError('API_HTTP_'+r.status,'A API oficial retornou HTTP '+r.status+'.',r.status);
  if(!/application\/json/i.test(r.headers.get('content-type')||''))throw importError('API_INVALID_RESPONSE','A API não retornou JSON.');
  const reader=r.body?.getReader();if(!reader)throw importError('API_INVALID_RESPONSE','Resposta vazia.');
  const chunks=[];let n=0;try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>2*1024*1024)throw importError('API_RESPONSE_TOO_LARGE','Resposta da API excede o limite de leitura.');chunks.push(value)}}finally{await reader.cancel().catch(()=>{});}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw importError('API_INVALID_RESPONSE','JSON inválido na API oficial.');}
 }
 const item=await get('');if(item?.id!==listing.itemId)throw importError('API_PRODUCT_MISMATCH','A API não retornou o anúncio solicitado.');
 const description=await get('/description');
 return {product:normalizeMeliItem(listing,item,description),url:listing.url};
}
