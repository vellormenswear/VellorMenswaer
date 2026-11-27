import './globals.css';
import Script from 'next/script';
import {headers} from 'next/headers';
export const dynamic='force-dynamic';
export const metadata={title:'VellorWear — Moda Masculina e Feminina',description:'VellorWear: moda masculina e feminina, relógios, calçados e acessórios.',icons:{icon:[{url:'/vellor-favicon-48.png?v=20261126-1',sizes:'48x48',type:'image/png'}],apple:[{url:'/apple-touch-icon.png?v=20261119',sizes:'180x180'}]}};
export default async function RootLayout({children}){const nonce=(await headers()).get('x-nonce')||undefined;return <html lang="pt-BR"><body><link rel="stylesheet" href="/vellor-campaigns.css?v=9"/><Script nonce={nonce} src="/checkout-trace.js?v=20261122" strategy="beforeInteractive"/><Script nonce={nonce} src="/vellor-seasonal-scenes.js?v=5" strategy="afterInteractive"/>{children}</body></html>}
