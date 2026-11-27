import {NextResponse} from 'next/server';
import {browserPolicy} from './lib/browser-policy.mjs';
export function middleware(req){
 const host=req.nextUrl.hostname,path=req.nextUrl.pathname;
 if(['www.vellormenswear.com.br','vellormenswear.com.br','vellormenswear.vercel.app'].includes(host)&&['GET','HEAD'].includes(req.method)&&path!=='/api'&&!path.startsWith('/api/')&&path!=='/pagamento'&&!path.startsWith('/pagamento/')&&!path.startsWith('/_next/')&&!path.includes('.')){
  const target=req.nextUrl.clone();target.protocol='https:';target.hostname='www.vellorwear.com.br';target.port='';
  return NextResponse.redirect(target,308);
 }
 const nonce=btoa(crypto.randomUUID());const policy=browserPolicy(nonce,process.env.NODE_ENV==='development');
 const requestHeaders=new Headers(req.headers);requestHeaders.set('x-nonce',nonce);requestHeaders.set('Content-Security-Policy',policy);
 const response=NextResponse.next({request:{headers:requestHeaders}});response.headers.set('Content-Security-Policy',policy);return response;
}
export const config={matcher:['/((?!api/|_next/|.*\\.).*)']};
