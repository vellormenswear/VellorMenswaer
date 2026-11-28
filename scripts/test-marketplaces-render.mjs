import {chromium} from 'playwright-core';
import serverChromium from '@sparticuz/chromium';
import {parseSupplierProduct,publicMarketplaceProduct,marketplaceSource} from '../lib/supplier-product-import.mjs';
import {fetchSupplierPage} from '../lib/supplier-public-fetch.mjs';
import {safeImportError} from '../lib/supplier-import-errors.mjs';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='qa/marketplaces-render-20261127')throw Error('Preview QA only');
const targets=[['shopee','https://shopee.com.br/Camisa-Masculina-Social-Slim-Fit-Luxo-Pronta-Entrega-Manga-Longa-Anti-Suor-Tecnol%C3%B3gica-i.631628506.58211355781?extraParams=%7B%22display_model_id%22%3A139657020910%2C%22model_selection_logic%22%3A3%7D&image_ids=br-11134207-820mb-msx7wrzbwah240'],['mercado_livre','https://produto.mercadolivre.com.br/MLB-5291857244-calca-jeans-feminina-wide-leg-pantalona-cintura-alta-algodo-_JM?searchVariation=186977075373']];
const allowed=['shopee.com.br','shopee.com','shopeemobile.com','shopeeusercontent.com','susercontent.com','mercadolivre.com.br','mercadolibre.com','mlstatic.com'];
const hostAllowed=raw=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&allowed.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))}catch{return false}};
const browserPath=await serverChromium.executablePath();
const launch=()=>chromium.launch({executablePath:browserPath,args:serverChromium.args.filter(x=>x!=='--single-process'),headless:true,env:{PATH:process.env.PATH,HOME:'/tmp',TMPDIR:'/tmp',LD_LIBRARY_PATH:process.env.LD_LIBRARY_PATH||''}});
for(const [name,url] of targets){
 let browser,context;
 try{
  try{const p=await fetchSupplierPage(url);const parsed=parseSupplierProduct(p.html,p.url);console.log('[market.qa.http]',JSON.stringify({name,bytes:Buffer.byteLength(p.html),product:parsed.name,photos:parsed.photos.length,variants:parsed.variants.length}))}catch(e){console.log('[market.qa.http.failure]',JSON.stringify({name,...safeImportError(e)}))}
  browser=await launch();
  context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  await context.route('**/*',r=>hostAllowed(r.request().url())&&['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
  await context.routeWebSocket('**/*',s=>s.close());
  const page=await context.newPage();
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
   await page.waitForTimeout(5500);
   const visible=await page.evaluate(()=>({title:document.title,heading:document.querySelector('h1')?.innerText||null,verification:(document.body?.innerText||'').slice(0,1800).match(/(?:verifique sua identidade|verificação de segurança|acesso negado|access denied|verify your identity|security verification|captcha)/i)?.[0]||null,images:document.images.length,htmlBytes:document.documentElement.outerHTML.length}));
   console.log('[market.qa.browser]',JSON.stringify({name,status:response?.status(),finalHost:new URL(page.url()).hostname,...visible}));
   if(!visible.verification){
    try{const parsed=publicMarketplaceProduct(parseSupplierProduct(await page.content(),page.url()),marketplaceSource(url));console.log('[market.qa.rendered]',JSON.stringify({name,product:parsed.name,photos:parsed.photos.length,variants:parsed.variants.length,incomplete:parsed.variants_incomplete}))}catch(e){console.log('[market.qa.rendered.failure]',JSON.stringify({name,...safeImportError(e)}))}
   }
  }catch(e){console.log('[market.qa.browser.failure]',JSON.stringify({name,error:String(e.message).slice(0,220)}))}
  }catch(e){console.log('[market.qa.browser.init.failure]',JSON.stringify({name,error:String(e.message).slice(0,220)}))}
 finally{await context?.close().catch(()=>{});await browser?.close().catch(()=>{})}
}
