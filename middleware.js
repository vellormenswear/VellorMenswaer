import {NextResponse} from 'next/server';

// Preserve legacy payment callbacks and API requests. Only public page navigation
// on the known production aliases is redirected to the official domain.
export function middleware(req){
 const host=req.nextUrl.hostname,path=req.nextUrl.pathname;
 if(!['www.vellormenswear.com.br','vellormenswear.vercel.app'].includes(host)||!['GET','HEAD'].includes(req.method))return NextResponse.next();
 if(path==='/api'||path.startsWith('/api/')||path==='/pagamento'||path.startsWith('/pagamento/')||path.startsWith('/_next/')||path.includes('.'))return NextResponse.next();
 const target=req.nextUrl.clone();target.protocol='https:';target.hostname='vellormenswear.com.br';target.port='';
 return NextResponse.redirect(target,308);
}
export const config={matcher:['/((?!api/|_next/|.*\\.).*)']};
