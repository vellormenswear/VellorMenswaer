import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='qa/cadastro-manual-disponibilidade-20261128'||!process.env.QA_MANUAL_DATABASE_URL)throw Error('Dedicated manual catalog QA required');
process.env.DATABASE_URL=process.env.QA_MANUAL_DATABASE_URL;
const {db,sql}=await import('../lib/db.js');
const {mutateSupplierListing,reviewSupplierListing,supplierListings}=await import('../lib/supplier-listings.js');
const {quoteCart}=await import('../lib/commerce.js');
const base='http://127.0.0.1:4182';let browser,server;
try{
 const marks=(await sql("SELECT p.category_id,p.supplier_id,u.id AS admin,s.user_id AS supplier_user FROM products p JOIN suppliers s ON s.id=p.supplier_id CROSS JOIN users u WHERE p.slug='qa-vellor-homologacao-20261125' AND u.email='qa-vellor-20261125-admin@example.invalid' AND s.status='active'")).rows;assert.equal(marks.length,1,'QA marker absent');const m=marks[0];
 const name='QA manual '+randomUUID(),supplier={id:m.supplier_id},user={id:m.supplier_user},admin={id:m.admin};
 const variant={key:randomUUID(),label:'Preto',sizes:['39'],cost_cents:6000,stock:null,stock_mode:'availability',supplier_available:true,reported_stock:999,preparation_days:2,delivery_days_min:5,delivery_days_max:15,image_url:'/product-images/sem-foto.svg'};
 const submit=await mutateSupplierListing(user,supplier,'submit',{name,description:'Manual QA',department:'masculino',category_id:m.category_id,request_id:randomUUID(),source_url:'https://example.invalid/no-external-call',variants:[variant,{...variant,key:randomUUID(),label:'Azul',sizes:['40'],supplier_available:false}]});
 assert.equal(submit.status,'pending');
 const pending=(await sql('SELECT variants FROM supplier_submissions WHERE id=$1',[submit.id])).rows[0].variants;
 assert.equal(pending.length,2);assert.ok(pending.every(v=>v.stock===null&&v.stock_mode==='availability'&&!Object.hasOwn(v,'reported_stock')));
 assert.equal((await sql('SELECT 1 FROM supplier_product_sources WHERE submission_id=$1',[submit.id])).rowCount,0);
 const reviewed=await reviewSupplierListing(admin,{id:submit.id,revision:submit.revision,decision:'approved',prices:Object.fromEntries(pending.map(v=>[v.sku,10000]))});
 const p=(await sql('SELECT id,slug FROM products WHERE name=$1',[name])).rows[0];assert.ok(p);
 const rows=(await sql('SELECT id,sku,label,sizes,stock_mode,stock,supplier_available,reported_stock FROM product_variants WHERE product_id=$1',[p.id])).rows;assert.equal(rows.length,2);assert.ok(rows.every(v=>v.stock===null&&v.stock_mode==='availability'&&v.reported_stock===null));
 const black=rows.find(v=>v.label==='Preto'),blue=rows.find(v=>v.label==='Azul');
 assert.equal((await quoteCart([{sku:black.sku,size:'39',qty:2}])).total_cents,20000);await assert.rejects(quoteCart([{sku:blue.sku,size:'40',qty:1}]),/indisponível/);
 assert.equal((await sql('SELECT 1 FROM supplier_product_sources WHERE product_id=$1',[p.id])).rowCount,0);
 const list=await supplierListings(supplier.id);assert.ok(list.some(x=>x.product_id===p.id));
 console.log('[manual.qa] PASS supplier submission, admin approval, boolean availability, no quantity, no source, cart respects selected variation');
 const tokens={};for(const [role,id] of [['admin',m.admin],['supplier',m.supplier_user]]){const t=randomBytes(32).toString('hex');tokens[role]=t;await sql("INSERT INTO sessions(user_id,token_hash,expires_at,user_agent) VALUES($1,$2,now()+interval '20 minutes','manual-catalog QA')",[id,createHash('sha256').update(t).digest('hex')]);}
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','4182','-H','127.0.0.1'],{env:{...process.env,DATABASE_URL:process.env.QA_MANUAL_DATABASE_URL,SITE_URL:base},stdio:['ignore','ignore','pipe']});server.stderr.on('data',b=>{const s=String(b);if(!/postgresql:|DATABASE_URL|Bearer /.test(s))console.log('[manual.qa.server]',s.slice(0,250))});
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break}catch{}if(i===59)throw Error('server unavailable');await new Promise(r=>setTimeout(r,500));}
 const request=async(path,role,data)=>{const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(role?{Cookie:'pg_goston_sid='+tokens[role]}:{})},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}};
 assert.equal((await request('/api/product-import','admin',{url:'https://example.invalid/item'})).status,410);
 const sync=await request('/api/supplier-stock-sync',null,{slug:p.slug});assert.equal(sync.status,200);assert.equal(sync.body.products.length,1);assert.equal(sync.body.products[0].sku,black.sku);
 const upd=await request('/api/suppliers/inventory','supplier',{variant_id:blue.id,stock_mode:'availability',available:true,reported_stock:123});assert.equal(upd.status,200,JSON.stringify(upd.body));
 assert.equal((await quoteCart([{sku:blue.sku,size:'40',qty:1}])).total_cents,10000);
 assert.equal((await sql('SELECT reported_stock FROM product_variants WHERE id=$1',[blue.id])).rows[0].reported_stock,null);
 await request('/api/suppliers/inventory','supplier',{variant_id:blue.id,stock_mode:'availability',available:false});
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(x=>x!=='--single-process'),headless:true});
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  for(const role of ['admin','supplier']){
   const ctx=await browser.newContext({viewport,deviceScaleFactor:1});await ctx.addCookies([{name:'pg_goston_sid',value:tokens[role],url:base,httpOnly:true,sameSite:'Lax'}]);
   const page=await ctx.newPage();await page.goto(base+(role==='admin'?'/admin':'/fornecedor'),{waitUntil:'domcontentloaded'});
   if(role==='admin'){await page.getByRole('button',{name:/^Produtos$/}).first().click();await page.getByRole('button',{name:/Novo produto/i}).first().click();}
   else{await page.getByRole('button',{name:/Novo anúncio|Novo produto/i}).first().click();}
   const grid=page.getByRole('group',{name:'Selecionar várias cores'});await grid.waitFor({state:'visible'});assert.equal(await page.locator('input[name="reported_stock"], input[type="url"]').count(),0);
   assert.equal(await page.getByRole('button',{name:/importar produto/i}).count(),0);
   await grid.getByRole('button',{name:'Preto',exact:true}).click();await grid.getByRole('button',{name:'Azul',exact:true}).click();
   const sizes=page.getByRole('group',{name:'Selecionar vários tamanhos'});await sizes.getByRole('button',{name:'P',exact:true}).click();await sizes.getByRole('button',{name:'M',exact:true}).click();await page.getByRole('button',{name:'Gerar 4 variações'}).click();
   const box=await grid.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1);
   assert.ok(await page.getByText('Disponibilidade',{exact:true}).count()>=1);
   console.log('[manual.qa.visual]',JSON.stringify({role,viewport,grid:box}));
   await ctx.close();
  }
 }
 console.log('[manual.qa] PASS desktop/mobile manual editors and selectable colors and sizes');
}finally{await browser?.close().catch(()=>{});server?.kill('SIGTERM');await db().end()}
