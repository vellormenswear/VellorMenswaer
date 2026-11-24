import {NextResponse} from 'next/server';
import {contentSecurityPolicy,PERMISSIONS_POLICY} from './lib/browser-policy.mjs';

// Preserve legacy payment callbacks and API requests. Only public page navigation
// on the known production aliases is redirected to the official domain.
function canonicalRedirect(req){
 const host=req.nextUrl.hostname,path=req.nextUrl.pathname;
 if(!['www.vellormenswear.com.br','vellormenswear.vercel.app'].includes(host)||!['GET','HEAD'].includes(req.method))return null;
 if(path==='/api'||path.startsWith('/api/')||path==='/pagamento'||path.startsWith('/pagamento/')||path.startsWith('/_next/')||path.includes('.'))return null;
 const target=req.nextUrl.clone();target.protocol='https:';target.hostname='vellormenswear.com.br';target.port='';
 return NextResponse.redirect(target,308);
}
export function middleware(req){
 const redirect=canonicalRedirect(req);if(redirect)return redirect;
 const nonce=btoa(crypto.randomUUID());
 const policy=contentSecurityPolicy(nonce,process.env.NODE_ENV!=='production');
 const requestHeaders=new Headers(req.headers);requestHeaders.set('x-nonce',nonce);requestHeaders.set('Content-Security-Policy',policy);
 const response=NextResponse.next({request:{headers:requestHeaders}});
 response.headers.set('Content-Security-Policy',policy);response.headers.set('Permissions-Policy',PERMISSIONS_POLICY);
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
export const config={matcher:['/((?!api/|_next/|.*\\.).*)']};
