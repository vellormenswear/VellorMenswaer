import {fetchSupplierPage} from './supplier-public-fetch.mjs';
import {parseSupplierProduct,shopifyProductEndpoint,parseShopifyProduct,combineShopifyProduct} from './supplier-product-import.mjs';
import {importError,logImportFailure} from './supplier-import-errors.mjs';
// Shared import and selection-time stock reader. One total deadline for all requests.
export async function readSupplierProduct(raw,{fetchPage=fetchSupplierPage}={}){
 const deadline=Date.now()+11000;
 const page=await fetchPage(raw,{deadline});
 let primary=null,primaryError;
 try{primary=parseSupplierProduct(page.html,page.url)}catch(e){primaryError=e}
 const endpoint=shopifyProductEndpoint(page.html,page.url);
 if(endpoint&&deadline>Date.now()){
  try{
   const response=await fetchPage(endpoint,{kind:'json',deadline});
   if(new URL(response.url).origin!==new URL(page.url).origin)throw importError('SHOPIFY_PRODUCT_MISMATCH','A resposta da loja não corresponde ao anúncio consultado.');
   const shop=parseShopifyProduct(response.html,endpoint,page.url);
   return {product:combineShopifyProduct(primary,shop),url:page.url};
  }catch(e){logImportFailure('shopify',e);if(!primary)throw e;}
 }
 if(primary)return {product:primary,url:page.url};
 throw primaryError||importError('NO_PRODUCT_DATA','O anúncio não disponibilizou dados de produto reconhecíveis.');
}
