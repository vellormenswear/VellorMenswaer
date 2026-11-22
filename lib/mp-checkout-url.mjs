// Fonte de verdade: Checkout Pro com vendedor de teste APP_USR usa init_point.
const VALID_HOSTS=new Set(['www.mercadopago.com.br','mercadopago.com.br','www.mercadopago.com','mercadopago.com']);
export function validateCheckoutProUrl(value){
 if(typeof value!=='string')return null;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  return VALID_HOSTS.has(url.hostname.toLowerCase())?value:null;
 }catch{return null}
}
export function checkoutProLink(preference){return validateCheckoutProUrl(preference?.init_point)}
export function checkoutProHost(value){
 const url=validateCheckoutProUrl(value);return url?new URL(url).hostname.toLowerCase():null;
}
