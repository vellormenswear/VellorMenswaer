import './globals.css';
import Script from 'next/script';
import {headers} from 'next/headers';
export const dynamic='force-dynamic';
export const metadata={title:'Vellor Menswear — Loja Masculina',description:'Vellor Menswear: moda masculina, relógios, calçados e acessórios.',icons:{icon:[{url:'/favicon.ico?v=20261119',sizes:'any',type:'image/x-icon'},{url:'/favicon-32x32.png?v=20261119',sizes:'32x32',type:'image/png'}],apple:[{url:'/apple-touch-icon.png?v=20261119',sizes:'180x180'}]}};
export default async function RootLayout({children}){const nonce=(await headers()).get('x-nonce')||undefined;return <html lang="pt-BR"><body><Script nonce={nonce} src="/checkout-trace.js?v=20261122" strategy="beforeInteractive"/>{children}</body></html>}
