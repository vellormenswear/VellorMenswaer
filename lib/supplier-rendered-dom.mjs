import {importError} from './supplier-import-errors.mjs';
import {supplierHttpError,supplierUrl} from './supplier-public-fetch.mjs';
import {parseSupplierProduct,marketplaceSource,publicMarketplaceProduct} from './supplier-product-import.mjs';
// Read the DOM of an already navigated Chromium page, through the same CDP
// DOM domain used by DevTools. The caller must own an isolated browser.
export async function captureRenderedProduct(page,{status,expectedUrl}={}){
 if(Number.isInteger(status)&&status!==200)throw supplierHttpError(status);
 const expected=supplierUrl(expectedUrl),actual=supplierUrl(page.url());
 const key=u=>{
  const h=u.hostname;
  if(h==='shopee.com.br'||h.endsWith('.shopee.com.br')){
   const m=u.pathname.match(/(?:-i\.|\/product\/)(\d+)[./](\d+)(?:\/|$)/);return m?'shopee:'+m[1]+':'+m[2]:null;
  }
  if(h==='mercadolivre.com.br'||h.endsWith('.mercadolivre.com.br')){
   const m=u.pathname.match(/(?:^|\/)MLB-?(\d+)(?:[-/]|$)/i);return m?'meli:'+m[1]:null;
  }
  return u.origin+u.pathname;
 };
 if(!key(expected)||key(expected)!==key(actual))throw importError('RENDERED_PRODUCT_MISMATCH','A página renderizada não corresponde ao anúncio solicitado.');
 const session=await page.context().newCDPSession(page);
 try{
  const {root}=await session.send('DOM.getDocument',{depth:1,pierce:false});
  const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector:'html'});
  if(!nodeId)throw importError('NO_RENDERED_DOM','O navegador não apresentou um documento HTML.');
  const {outerHTML}=await session.send('DOM.getOuterHTML',{nodeId});
  if(Buffer.byteLength(outerHTML)>5*1024*1024)throw importError('RENDERED_DOM_TOO_LARGE','O documento renderizado excede o limite de leitura.');
  const p=publicMarketplaceProduct(parseSupplierProduct(outerHTML,actual.href),marketplaceSource(actual.href));
  if(!p.name)throw importError('NO_PRODUCT_DATA','O DOM não contém um nome de produto reconhecível.');
  return {product:p,url:actual.href,bytes:Buffer.byteLength(outerHTML)};
 }finally{await session.detach().catch(()=>{});}
}
