import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import serverChromium from '@sparticuz/chromium';
import {captureRenderedProduct} from '../lib/supplier-rendered-dom.mjs';
import {safeImportError} from '../lib/supplier-import-errors.mjs';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='qa/importacao-cdp-reteste-20261127')throw Error('QA preview only');
const targets=[
 ['shopee','https://shopee.com.br/Camisa-Masculina-Social-Slim-Fit-Luxo-Pronta-Entrega-Manga-Longa-Anti-Suor-Tecnol%C3%B3gica-i.631628506.58211355781?extraParams=%7B%22display_model_id%22%3A139657020910%2C%22model_selection_logic%22%3A3%7D&image_ids=br-11134207-820mb-msx7wrzbwah240'],
 ['mercado_livre','https://produto.mercadolivre.com.br/MLB-5291857244-calca-jeans-feminina-wide-leg-pantalona-cintura-alta-algodo-_JM?searchVariation=186977075373#polycard_client=recommendations_home_navigation-recommendations&reco_backend=machinalis-homes-univb-equivalent-offer&reco_client=home_navigation-recommendations&reco_item_pos=5&reco_backend_type=function&reco_id=1c846d05-f265-44f4-a9f3-6100e6e44582&sid=recos&c_id=/home/navigation-recommendations/element&c_uid=462e47e1-5759-44aa-aa62-83bc0c3dcb64']
];
const approved=['shopee.com.br','shopee.com','shopeemobile.com','shopeeusercontent.com','susercontent.com','mercadolivre.com.br','mercadolibre.com','mlstatic.com'];
const allowed=raw=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&approved.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}};
const executablePath=await serverChromium.executablePath();
const launch=()=>chromium.launch({executablePath,args:serverChromium.args.filter(x=>x!=='--single-process'),headless:true,env:{PATH:process.env.PATH,HOME:'/tmp',TMPDIR:'/tmp',LD_LIBRARY_PATH:process.env.LD_LIBRARY_PATH||''}});
async function withBrowser(fn){
 const browser=await launch();let context;
 try{context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});await context.routeWebSocket('**/*',s=>s.close());return await fn(context);}
 finally{await context?.close().catch(()=>{});await browser.close().catch(()=>{});}
}
// Real Chromium: the HTML before JavaScript has no product data.
await withBrowser(async context=>{
 const url='https://fixture.example.com/product/test';
 await context.route('**/*',r=>r.request().url()===url?r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head></head><body><script>setTimeout(()=>{const data={"@type":"ProductGroup","name":"Camisa QA","description":"Descrição QA","image":["https://cdn.example.com/front.jpg"],"hasVariant":[{"@type":"Product","color":"Azul","size":"M","offers":{"@type":"Offer","availability":"InStock","inventoryLevel":{"value":3},"price":123456}},{"@type":"Product","color":"Preto","size":"G","offers":{"@type":"Offer","availability":"OutOfStock"}}]};const s=document.createElement("script");s.type="application/ld+json";s.textContent=JSON.stringify(data);document.head.append(s);document.body.insertAdjacentHTML("beforeend", \'<h1>Camisa QA</h1><div class="product-gallery"><img data-src="https://cdn.example.com/detail.jpg"></div><footer><img src="https://cdn.example.com/logo.jpg"></footer>\');},300)</script></body></html>'}):r.abort());
 const page=await context.newPage();const response=await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForSelector('h1',{timeout:5000});
 const x=await captureRenderedProduct(page,{status:response.status(),expectedUrl:url});
 assert.equal(x.product.name,'Camisa QA');assert.deepEqual(x.product.photos,['https://cdn.example.com/front.jpg','https://cdn.example.com/detail.jpg']);
 assert.deepEqual(x.product.variants.map(v=>[v.label,v.sizes[0],v.supplier_available,v.reported_stock]),[['Azul','M',true,3],['Preto','G',false,null]]);
 assert.ok(!JSON.stringify(x).includes('123456'));await assert.rejects(captureRenderedProduct(page,{status:403,expectedUrl:url}),e=>e.code==='HTTP_403');
 await assert.rejects(captureRenderedProduct(page,{status:200,expectedUrl:'https://fixture.example.com/product/other'}),e=>e.code==='RENDERED_PRODUCT_MISMATCH');
 console.log('[cdp.fixture] PASS: dynamic DOM, gallery photos, exact variants, explicit stock, no prices, HTTP refusal and product mismatch');
});
const results=[];
for(const [name,url] of targets){
 let stage='browser',status=null,crashed=false,closed=false,requests=0,skipped=0,attempts=0;
 const start=Date.now();
 try{
  await withBrowser(async context=>{
   await context.route('**/*',r=>{
    requests++;
    // Skip binary resources only: the DOM can expose their URLs without decoding them.
    if(['image','media','font'].includes(r.request().resourceType())){skipped++;return r.abort();}
    return allowed(r.request().url())&&['GET','HEAD'].includes(r.request().method())?r.continue():r.abort();
   });
   const page=await context.newPage();
   page.on('crash',()=>{crashed=true});page.on('close',()=>{closed=true});
   stage='navigation';
   const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:18000});status=res?.status()??null;
   console.log('[cdp.retest.navigation]',JSON.stringify({name,status,host:new URL(page.url()).hostname}));
   if(status!==200){await captureRenderedProduct(page,{status,expectedUrl:url});return;}
   stage='cdp';let x,previousError;
   const deadline=Date.now()+6500;
   do{
    attempts++;
    try{x=await captureRenderedProduct(page,{status,expectedUrl:url});break;}
    catch(e){previousError=e;if(e.code!=='NO_PRODUCT_DATA')throw e;}
    await new Promise(r=>setTimeout(r,500));
   }while(Date.now()<deadline);
   if(!x)throw previousError;
   const result={name,status,title:x.product.name,descriptionLength:x.product.description.length,photos:x.product.photos.length,variants:x.product.variants.length,incomplete:x.product.variants_incomplete,knownStock:x.product.variants.filter(v=>v.reported_stock!=null).length,bytes:x.bytes,attempts,requests,skipped,elapsedMs:Date.now()-start};
   console.log('[cdp.retest.real]',JSON.stringify(result));
   // Both title and images must be read from the actual listing; incomplete variants are not full validation.
   const complete=Boolean(x.product.name&&x.product.description&&x.product.photos.length&&x.product.variants.length&&!x.product.variants_incomplete&&x.product.variants.every(v=>typeof v.supplier_available==='boolean'));
   results.push({name,passed:complete});
  });
 }catch(e){
  const detail=safeImportError(e);
  const closedError=crashed||closed&&/closed|crash/i.test(String(e.message));
  console.log('[cdp.retest.failure]',JSON.stringify({name,stage,status,...detail,...(closedError&&detail.code==='UNKNOWN'?{code:'BROWSER_CLOSED',message:'A página ou o navegador encerrou durante a consulta.'}:{}),crashed,closed,attempts,requests,skipped,elapsedMs:Date.now()-start}));
  results.push({name,passed:false});
 }
}
console.log('[cdp.retest.gate]',JSON.stringify(results));
if(results.length!==targets.length||results.some(x=>!x.passed))throw Error('Real listing validation incomplete: release gate failed.');
