import {fetchSupplierPage} from './supplier-public-fetch.mjs';
import {parseSupplierProduct,shopifyProductEndpoint,parseShopifyProduct,combineShopifyProduct,marketplaceSource,publicMarketplaceProduct,wooProductEndpoint,parseWooProduct,wooVariationRows} from './supplier-product-import.mjs';
import {importError,logImportFailure} from './supplier-import-errors.mjs';
function marketplaceError(source,error){
 if(!source)return error;
 if(['HTTP_401','HTTP_403','NO_PRODUCT_DATA','CONTENT_TYPE'].includes(error?.code)){
  const name=source==='mercado_livre'?'Mercado Livre':'Shopee';
  return importError('MARKETPLACE_ACCESS_REQUIRED',name+': os dados públicos não puderam ser consultados. Para dados restritos, é necessária autorização oficial do vendedor.',error.status);
 }
 return error;
}
// Shared import and selection-time stock reader. One total deadline for all requests.
export async function readSupplierProduct(raw,{fetchPage=fetchSupplierPage}={}){
 const deadline=Date.now()+11000;
 let source=null;try{source=marketplaceSource(raw)}catch{}
 let page;try{page=await fetchPage(raw,{deadline})}catch(e){throw marketplaceError(source,e)}
 source=marketplaceSource(page.url)||source;
 let primary=null,primaryError;
 try{primary=parseSupplierProduct(page.html,page.url)}catch(e){primaryError=e}
 if(source){if(primary)return {product:publicMarketplaceProduct(primary,source),url:page.url};throw marketplaceError(source,primaryError);}
 const endpoint=shopifyProductEndpoint(page.html,page.url),woo=wooProductEndpoint(page.html,page.url);
 if(endpoint&&deadline>Date.now()){
  try{
   const response=await fetchPage(endpoint,{kind:'json',deadline});
   if(new URL(response.url).origin!==new URL(page.url).origin)throw importError('SHOPIFY_PRODUCT_MISMATCH','A resposta da loja não corresponde ao anúncio consultado.');
   const shop=parseShopifyProduct(response.html,endpoint,page.url);
   return {product:combineShopifyProduct(primary,shop),url:page.url};
  }catch(e){logImportFailure('shopify',e);if(!primary)throw e;}
 }
 if(woo&&deadline>Date.now()){
  try{
   const response=await fetchPage(woo,{kind:'json',deadline});
   if(new URL(response.url).origin!==new URL(page.url).origin)throw importError('WOO_PRODUCT_MISMATCH','A resposta da loja não corresponde ao anúncio consultado.');
   const product=parseWooProduct(response.html,page.url);
   const merged=combineShopifyProduct(primary,product);
   const variants=wooVariationRows(page.html,page.url);
   if(variants.length)return {product:combineShopifyProduct(merged,{...product,variants,variants_incomplete:false}),url:page.url};
   return {product:merged,url:page.url};
  }catch(e){logImportFailure('woocommerce',e);if(!primary)throw e;}
 }
 if(primary)return {product:primary,url:page.url};
 throw primaryError||importError('NO_PRODUCT_DATA','O anúncio não disponibilizou dados de produto reconhecíveis.');
}
