// Explicit browser-assisted import, from product data selected by the signed-in user.
import {supplierUrl} from './supplier-public-fetch.mjs';
import {importError} from './supplier-import-errors.mjs';
export function browserProductSnapshot(raw,url){
 const fail=()=>importError('INVALID_BROWSER_CAPTURE','A captura do navegador é inválida. Capture novamente o anúncio.');
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1||raw.url!==url||typeof raw.name!=='string'||typeof raw.description!=='string'||!Array.isArray(raw.photos)||raw.photos.length>30)throw fail();
 const source=supplierUrl(url).href;
 const name=raw.name.replace(/\s+/g,' ').trim().slice(0,220),description=raw.description.trim().slice(0,4000);
 if(!name)throw fail();
 const photos=[];
 for(const value of raw.photos){
  if(typeof value!=='string'||value.length>1000)throw fail();
  const href=supplierUrl(value).href;
  if(!photos.includes(href))photos.push(href);
 }
 return {url:source,product:{name,description,category:'',photos,variants:[],variants_incomplete:true}};
}
