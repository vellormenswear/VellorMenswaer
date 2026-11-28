import {fetchSupplierPage} from '../lib/supplier-public-fetch.mjs';
import {readSupplierProduct} from '../lib/read-supplier-product.mjs';
import {extractProductPageImages} from '../lib/supplier-page-images.mjs';
import {safeImportError} from '../lib/supplier-import-errors.mjs';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='qa/shopee-consulta-20261127')throw Error('QA only');
const original='https://shopee.com.br/Camisa-Masculina-Social-Slim-Fit-Luxo-Pronta-Entrega-Manga-Longa-Anti-Suor-Tecnol%C3%B3gica-i.631628506.58211355781?extraParams=%7B%22display_model_id%22%3A139657020910%2C%22model_selection_logic%22%3A3%7D&image_ids=br-11134207-820mb-msx7wrzbwah240';
const urls=[['original',original],['without_query',original.split('?')[0]],['canonical','https://shopee.com.br/product/631628506/58211355781']];
for(const [kind,url] of urls){
 let page;const start=Date.now();
 try{
  page=await fetchSupplierPage(url);
  const html=page.html,scan=extractProductPageImages(html,page.url);
  const title=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().slice(0,200)||null;
  console.log('[shopee.qa.page]',JSON.stringify({kind,elapsed:Date.now()-start,finalHost:new URL(page.url).hostname,finalPath:new URL(page.url).pathname,bytes:Buffer.byteLength(html),title,ldjson:/application\/ld\+json/i.test(html),ogtype:html.match(/<meta\b[^>]*(?:property|name)=["']og:type["'][^>]*>/i)?.[0]?.slice(0,200)||null,htmlImages:(html.match(/<img\b/gi)||[]).length,galleryPhotos:scan.photos.length,identified:scan.identified,challengeMarker:/captcha|verify your identity|access denied|security verification|verificação de segurança/i.test(html)}));
  const r=await readSupplierProduct(url,{fetchPage:async()=>page});
  console.log('[shopee.qa.import]',JSON.stringify({kind,name:r.product.name,descriptionLength:r.product.description.length,photos:r.product.photos.length,variants:r.product.variants.length,knownStock:r.product.variants.filter(v=>Number.isInteger(v.reported_stock)).length,incomplete:r.product.variants_incomplete}));
 }catch(e){console.log('[shopee.qa.failure]',JSON.stringify({kind,stage:page?'parse':'fetch',elapsed:Date.now()-start,...safeImportError(e)}));}
}
