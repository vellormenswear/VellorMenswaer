export function browserPolicy(nonce,development=false){
 return ["default-src 'self'","script-src 'self' 'nonce-"+nonce+"'"+(development?" 'unsafe-eval'":""),"script-src-attr 'none'","object-src 'none'","base-uri 'self'","frame-ancestors 'none'","frame-src 'none'","form-action 'self'","img-src 'self' https: data: blob:","style-src 'self' 'unsafe-inline' https://fonts.googleapis.com","font-src 'self' https://fonts.gstatic.com data:","connect-src 'self' https://api.checkout.infinitepay.io"+(development?' ws: wss:':''),...(development?[]:['upgrade-insecure-requests'])].join('; ');
}
