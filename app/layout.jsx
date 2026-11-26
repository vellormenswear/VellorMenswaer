import './globals.css';
import Script from 'next/script';
export const metadata={title:'VellorWear — Moda Masculina e Feminina',description:'VellorWear: moda masculina e feminina, relógios, calçados e acessórios.',icons:{icon:[{url:'/vellor-favicon-48.png?v=20261126-1',sizes:'48x48',type:'image/png'}],apple:[{url:'/apple-touch-icon.png?v=20261119',sizes:'180x180'}]}};
export default function RootLayout({children}){return <html lang="pt-BR"><body><link rel="stylesheet" href="/vellor-campaigns.css?v=8"/><Script src="/checkout-trace.js?v=20261122" strategy="beforeInteractive"/><Script src="/vellor-seasonal-scenes.js?v=5" strategy="afterInteractive"/>{children}</body></html>}
