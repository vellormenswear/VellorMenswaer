import './globals.css';
import Script from 'next/script';
export const metadata={title:'VellorWear — Moda Masculina e Feminina',description:'VellorWear: moda masculina e feminina, relógios, calçados e acessórios.',icons:{icon:[{url:'/favicon.ico?v=20261119',sizes:'any',type:'image/x-icon'},{url:'/favicon-32x32.png?v=20261119',sizes:'32x32',type:'image/png'}],apple:[{url:'/apple-touch-icon.png?v=20261119',sizes:'180x180'}]}};
export default function RootLayout({children}){return <html lang="pt-BR"><body><Script src="/checkout-trace.js?v=20261122" strategy="beforeInteractive"/>{children}</body></html>}
