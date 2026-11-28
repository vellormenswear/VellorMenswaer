import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='qa/catalogo-compacto-relogios-20261128'||!process.env.QA_COMPACT_DATABASE_URL)throw Error('Dedicated manual catalog QA required');
process.env.DATABASE_URL=process.env.QA_COMPACT_DATABASE_URL;
const {db,sql,transaction}=await import('../lib/db.js');
const {mutateSupplierListing,reviewSupplierListing,supplierListings}=await import('../lib/supplier-listings.js');
const {quoteCart}=await import('../lib/commerce.js');
const base='http://127.0.0.1:4183';let browser,server;
try{
 const marks=(await sql("SELECT p.category_id,p.supplier_id,u.id AS admin,s.user_id AS supplier_user FROM products p JOIN suppliers s ON s.id=p.supplier_id CROSS JOIN users u WHERE p.slug='qa-vellor-homologacao-20261125' AND u.email='qa-vellor-20261125-admin@example.invalid' AND s.status='active'")).rows;assert.equal(marks.length,1,'QA marker absent');const m=marks[0];
 const migration=await readFile(new URL('../db/027_manual_product_availability.sql',import.meta.url),'utf8');
 await transaction(async c=>{
  const before=(await c.query("SELECT v.id,v.sku,v.price_cents,v.supplier_available AND COALESCE(v.stock,0)>0 AS available FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.launch_archived_at IS NULL AND v.supplier_retired_at IS NULL AND v.stock_mode='quantity' ORDER BY v.id")).rows;
  await c.query(migration);
  const after=(await c.query("SELECT id,sku,price_cents,supplier_available AS available FROM product_variants WHERE id=ANY($1::uuid[]) ORDER BY id",[before.map(x=>x.id)])).rows;
  assert.deepEqual(after,before);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.launch_archived_at IS NULL AND v.supplier_retired_at IS NULL AND v.stock_mode='quantity'")).rows[0].n,0);
  console.log('[manual.qa] PASS legacy conversion, exact availability and identifiers preserved, rows='+before.length);
 });
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
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','4183','-H','127.0.0.1'],{env:{...process.env,DATABASE_URL:process.env.QA_COMPACT_DATABASE_URL,SITE_URL:base},stdio:['ignore','ignore','pipe']});server.stderr.on('data',b=>{const s=String(b);if(!/postgresql:|DATABASE_URL|Bearer /.test(s))console.log('[manual.qa.server]',s.slice(0,250))});
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break}catch{}if(i===59)throw Error('server unavailable');await new Promise(r=>setTimeout(r,500));}
 const request=async(path,role,data)=>{const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(role?{Cookie:'pg_goston_sid='+tokens[role]}:{})},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}};
 assert.equal((await request('/api/product-import','admin',{url:'https://example.invalid/item'})).status,410);
 const sync=await request('/api/supplier-stock-sync',null,{slug:p.slug});assert.equal(sync.status,200);assert.equal(sync.body.products.length,1);assert.equal(sync.body.products[0].sku,black.sku);
 const upd=await request('/api/suppliers/inventory','supplier',{variant_id:blue.id,stock_mode:'availability',available:true,reported_stock:123});assert.equal(upd.status,200,JSON.stringify(upd.body));
 assert.equal((await quoteCart([{sku:blue.sku,size:'40',qty:1}])).total_cents,10000);
 assert.equal((await sql('SELECT reported_stock FROM product_variants WHERE id=$1',[blue.id])).rows[0].reported_stock,null);
 await request('/api/suppliers/inventory','supplier',{variant_id:blue.id,stock_mode:'availability',available:false});
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(x=>x!=='--single-process'),headless:true});

 const tag='QA agrupado '+randomUUID();
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  for(const role of ['admin','supplier']){
   const ctx=await browser.newContext({viewport,deviceScaleFactor:1});await ctx.addCookies([{name:'pg_goston_sid',value:tokens[role],url:base,httpOnly:true,sameSite:'Lax'}]);
   const page=await ctx.newPage();const name=tag+' '+role+' '+viewport.width;let uploadCount=0;
   await page.route('**/api/'+(role==='admin'?'admin':'suppliers')+'/upload',async route=>{uploadCount++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:'https://example.invalid/qa-'+uploadCount+'.png'})})});
   await page.route('https://example.invalid/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR9sAAAAASUVORK5CYII=','base64')}));
   await page.goto(base+(role==='admin'?'/admin':'/fornecedor'),{waitUntil:'domcontentloaded'});
   if(role==='admin'){await page.getByRole('button',{name:/^Produtos$/}).first().click();await page.getByRole('button',{name:/Novo produto/i}).first().click();}
   else{await page.getByRole('button',{name:/Novo anúncio/i}).first().click();}
   const grid=page.getByRole('group',{name:'Selecionar várias cores'});await grid.waitFor({state:'visible'});
   assert.equal(await page.getByRole('button',{name:/importar produto/i}).count(),0);
   await page.getByRole('textbox',{name:'Nome do produto',exact:true}).fill(name);
   const dept=role==='admin'?page.locator('#product-department'):page.locator('#listing-department');await dept.selectOption('masculino');
   // CategoryPicker uses a two-level selector. Choose known category by its option values.
   const cats=(await sql('SELECT id,name,parent_id FROM categories WHERE id=$1',[m.category_id])).rows[0];
   const parent=String(cats.parent_id||cats.id),child=String(cats.id);
   const selectParent=page.locator('select').filter({has:page.locator('option[value="'+parent+'"]')}).first();await selectParent.selectOption(parent);
   if(parent!==child){const sub=page.locator('select').filter({has:page.locator('option[value="'+child+'"]')}).last();await sub.selectOption(child);}
   if(role==='admin'){const supplierName=(await sql('SELECT business_name FROM suppliers WHERE id=$1',[m.supplier_id])).rows[0].business_name;await page.getByRole('combobox',{name:'Fornecedor'}).click();await page.getByRole('option',{name:supplierName,exact:true}).click();}
   await grid.getByRole('button',{name:'Preto',exact:true}).click();await grid.getByRole('button',{name:'Azul',exact:true}).click();
   const sizes=page.getByRole('group',{name:'Selecionar vários tamanhos'});await sizes.getByRole('button',{name:'39',exact:true}).click();await sizes.getByRole('button',{name:'40',exact:true}).click();await page.getByRole('button',{name:'Gerar 4 variações'}).click();
   const panel=page.locator('[data-grouped-variants]');assert.equal(await panel.locator('[data-color-group]').count(),2);assert.equal(await panel.locator('input[type=file]').count(),2);assert.equal(await panel.locator('input[inputmode=decimal]:visible').count(),role==='admin'?2:1);
   const cost=role==='admin'?'Preço de custo (R$)':'Preço do fornecedor (R$)';
   await panel.getByRole('textbox',{name:cost+' — Todas as variações',exact:true}).fill('60,00');
   if(role==='admin')await panel.getByRole('textbox',{name:'Preço de venda (R$) — Todas as variações',exact:true}).fill('100,00');
   await panel.getByRole('button',{name:'Preço por variação',exact:true}).click();
   await panel.getByRole('textbox',{name:cost+' — Azul',exact:true}).fill('65,00');
   if(role==='admin')await panel.getByRole('textbox',{name:'Preço de venda (R$) — Azul',exact:true}).fill('110,00');
   const file={name:'qa.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR9sAAAAASUVORK5CYII=','base64')};
   await panel.getByLabel('Adicionar foto — Preto',{exact:true}).setInputFiles(file);await panel.getByAltText('Foto — Preto',{exact:true}).waitFor({state:'visible'});
   await panel.getByLabel('Adicionar foto — Azul',{exact:true}).setInputFiles(file);await panel.getByAltText('Foto — Azul',{exact:true}).waitFor({state:'visible'});
   assert.equal(uploadCount,2);
   await panel.getByRole('button',{name:'Preto 40 — Disponível',exact:true}).click();assert.equal(await panel.getByRole('button',{name:'Preto 40 — Indisponível',exact:true}).getAttribute('aria-pressed'),'false');
   assert.equal(await panel.getByRole('button',{name:'Preto 39 — Disponível',exact:true}).getAttribute('aria-pressed'),'true');
   const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1);
   const actual=await panel.getByRole('button',{name:'Preço por variação',exact:true}).evaluate(el=>getComputedStyle(el).backgroundImage);assert.equal(actual,'none');const action=page.getByRole('button',{name:role==='admin'?'Salvar produto':'Enviar para aprovação',exact:true});assert.match(await action.evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/);const uploadBox=await panel.getByLabel('Adicionar foto — Preto',{exact:true}).boundingBox();assert.ok(uploadBox.width<=102&&Math.abs(uploadBox.width-uploadBox.height)<=3);const sizeBox=await panel.getByRole('button',{name:'Preto 39 — Disponível',exact:true}).boundingBox();assert.ok(sizeBox.width<=80);
   const request=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith(role==='admin'?'/api/admin/product-listing':'/api/suppliers/submit'));
   await page.getByRole('button',{name:role==='admin'?'Salvar produto':'Enviar para aprovação',exact:true}).click();
   const response=await request;assert.equal(response.status(),role==='admin'?200:201,JSON.stringify(await response.json()).slice(0,500));const saved=await response.json();
   const values=role==='admin'?(await sql('SELECT label,sizes,sku,primary_image_url AS image_url,supplier_cost_cents AS cost_cents,price_cents,supplier_available FROM product_variants WHERE product_id=$1',[saved.id])).rows:(await sql('SELECT variants FROM supplier_submissions WHERE id=$1',[saved.id])).rows[0].variants;
   assert.equal(values.length,4);assert.equal(new Set(values.map(v=>v.sku)).size,4);for(const v of values){assert.equal(v.image_url,v.label==='Preto'?'https://example.invalid/qa-1.png':'https://example.invalid/qa-2.png');assert.equal(v.cost_cents,v.label==='Preto'?6000:6500);assert.equal(v.supplier_available,!(v.label==='Preto'&&v.sizes[0]==='40'));if(role==='admin')assert.equal(v.price_cents,v.label==='Preto'?10000:11000);}
   console.log('[grouped.qa.visual]',JSON.stringify({role,viewport,groups:2,uploads:uploadCount,variants:values.length,gradient:actual}));
   await ctx.close();
  }
 }
 console.log('[grouped.qa] PASS desktop/mobile both roles, unique/color prices, one image per color, independent size availability, four preserved SKUs and real saves');
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1});
  await ctx.addCookies([{name:'pg_goston_sid',value:tokens.admin,url:base,httpOnly:true,sameSite:'Lax'}]);
  const page=await ctx.newPage();
  // Use an approved seasonal theme response, without changing real campaign configuration.
  await page.route('**/api/store/campaign',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({campaign:{theme:'natal',decoration:true,intensity:'discreta'},revision:'qa'})}));
  await page.goto(base+'/admin',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Produtos',exact:true}).first().click();
  await page.getByRole('button',{name:'Pendentes',exact:true}).click();
  const name=tag+' supplier '+viewport.width;
  const heading=page.getByText(name,{exact:true});
  await heading.waitFor({state:'visible'});
  const card=heading.locator('xpath=../..');
  const groups=card.locator('[data-color-group]');
  assert.equal(await groups.count(),2);
  const black=groups.filter({has:page.getByText('Preto',{exact:true})});
  const blue=groups.filter({has:page.getByText('Azul',{exact:true})});
  assert.equal(await black.getByText('Indisponível',{exact:true}).count(),1);
  assert.equal(await blue.getByText('Disponível',{exact:true}).count(),2);
  const mode=card.getByRole('button',{name:'Preço único',exact:true});
  await mode.waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('.vll-layout-content')?.dataset.season==='natal');
  assert.equal(await mode.evaluate(el=>getComputedStyle(el).backgroundImage),'none');const gradient=await card.getByRole('button',{name:'APROVAR E PUBLICAR',exact:true}).evaluate(el=>getComputedStyle(el).backgroundImage);
  assert.equal(gradient,'linear-gradient(90deg, rgb(16, 59, 44) 0%, rgb(48, 37, 42) 50%, rgb(102, 32, 43) 100%)');
  await card.getByRole('textbox',{name:'Preço VELLOR (R$) — Todas as variações',exact:true}).fill('100,00');
  await card.getByRole('button',{name:'Preço por variação',exact:true}).click();
  await card.getByRole('textbox',{name:'Preço VELLOR (R$) — Azul',exact:true}).fill('110,00');
  assert.equal(await black.getByRole('textbox',{name:'Preço VELLOR (R$) — Preto',exact:true}).inputValue(),'100,00');
  for(const group of await groups.all()){const box=await group.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1);}
  const response=page.waitForResponse(r=>r.url().endsWith('/api/suppliers/admin-review')&&r.request().method()==='POST');
  await card.getByRole('button',{name:'APROVAR E PUBLICAR',exact:true}).click();
  const r=await response;assert.equal(r.status(),200,JSON.stringify(await r.json()).slice(0,400));
  const product=(await sql('SELECT id,slug FROM products WHERE name=$1',[name])).rows[0];assert.ok(product);
  const rows=(await sql('SELECT label,sizes,sku,price_cents,supplier_cost_cents,primary_image_url,supplier_available FROM product_variants WHERE product_id=$1',[product.id])).rows;
  assert.equal(rows.length,4);assert.equal(new Set(rows.map(v=>v.sku)).size,4);
  for(const v of rows){assert.equal(v.price_cents,v.label==='Preto'?10000:11000);assert.equal(v.supplier_cost_cents,v.label==='Preto'?6000:6500);assert.equal(v.primary_image_url,v.label==='Preto'?'https://example.invalid/qa-1.png':'https://example.invalid/qa-2.png');assert.equal(v.supplier_available,!(v.label==='Preto'&&v.sizes[0]==='40'));}
  const catalog=await(await fetch(base+'/api/catalog?slug='+product.slug)).json();
  assert.equal(catalog.products.length,3);assert.equal(new Set(catalog.products.map(v=>v.slug)).size,1);
  console.log('[grouped.qa.review]',JSON.stringify({viewport,groups:2,variants:rows.length,publicModelCount:1,gradient}));
  await ctx.close();
 }
 console.log('[grouped.qa] PASS real admin review and seasonal gradient in desktop/mobile, one published product');
 const watchCat=(await sql("SELECT id,parent_id FROM categories WHERE slug='relogios-classicos' AND active")).rows[0];assert.ok(watchCat);
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  for(const role of ['admin','supplier']){
   const ctx=await browser.newContext({viewport});await ctx.addCookies([{name:'pg_goston_sid',value:tokens[role],url:base,httpOnly:true,sameSite:'Lax'}]);
   const page=await ctx.newPage(),name=tag+' relogio '+role+' '+viewport.width;
   await page.goto(base+(role==='admin'?'/admin':'/fornecedor'),{waitUntil:'domcontentloaded'});
   if(role==='admin'){await page.getByRole('button',{name:'Produtos',exact:true}).first().click();await page.getByRole('button',{name:/Novo produto/i}).first().click();}
   else await page.getByRole('button',{name:/Novo anúncio/i}).first().click();
   await page.getByRole('textbox',{name:'Nome do produto',exact:true}).fill(name);
   await (role==='admin'?page.locator('#product-department'):page.locator('#listing-department')).selectOption('masculino');
   await page.locator('select').filter({has:page.locator('option[value="'+watchCat.parent_id+'"]')}).first().selectOption(watchCat.parent_id);
   await page.locator('select').filter({has:page.locator('option[value="'+watchCat.id+'"]')}).last().selectOption(watchCat.id);
   if(role==='admin'){const supplierName=(await sql('SELECT business_name FROM suppliers WHERE id=$1',[m.supplier_id])).rows[0].business_name;await page.getByRole('combobox',{name:'Fornecedor'}).click();await page.getByRole('option',{name:supplierName,exact:true}).click();}
   const colors=page.getByRole('group',{name:'Selecionar várias cores'});await colors.getByRole('button',{name:'Prata',exact:true}).click();await colors.getByRole('button',{name:'Dourado',exact:true}).click();
   assert.equal(await page.getByRole('group',{name:'Selecionar vários tamanhos'}).count(),0);
   assert.equal(await page.getByRole('textbox',{name:'Outro tamanho',exact:true}).count(),0);
   assert.equal(await colors.getByRole('button',{name:'Prata',exact:true}).evaluate(el=>getComputedStyle(el).backgroundImage),'none');
   await page.getByRole('button',{name:'Gerar 2 variações',exact:true}).click();
   const panel=page.locator('[data-grouped-variants]');assert.equal(await panel.locator('[data-color-group]').count(),2);
   assert.equal(await panel.getByRole('button',{name:'Prata Único — Disponível',exact:true}).count(),1);
   assert.equal(await panel.getByRole('button',{name:'Dourado Único — Disponível',exact:true}).count(),1);
   assert.equal(await panel.locator('input[type=file]').count(),2);assert.equal(await panel.getByText('URL da imagem (opcional)',{exact:true}).count(),0);
   const cost=role==='admin'?'Preço de custo (R$)':'Preço do fornecedor (R$)';
   await panel.getByRole('textbox',{name:cost+' — Todas as variações',exact:true}).fill('70,00');
   if(role==='admin')await panel.getByRole('textbox',{name:'Preço de venda (R$) — Todas as variações',exact:true}).fill('125,00');
   // A fixture upload verifies the existing handler without using production storage.
   const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR9sAAAAASUVORK5CYII=','base64');
   await page.route('**/api/'+(role==='admin'?'admin':'suppliers')+'/upload',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:'/product-images/sem-foto.svg'})}));
   for(const color of ['Prata','Dourado']){await panel.getByLabel('Adicionar foto — '+color,{exact:true}).setInputFiles({name:'qa.png',mimeType:'image/png',buffer:png});await panel.getByAltText('Foto — '+color,{exact:true}).waitFor({state:'visible'});}
   const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith(role==='admin'?'/api/admin/product-listing':'/api/suppliers/submit'));
   await page.getByRole('button',{name:role==='admin'?'Salvar produto':'Enviar para aprovação',exact:true}).click();
   const r=await response;assert.equal(r.status(),role==='admin'?200:201,JSON.stringify(await r.json()).slice(0,500));const saved=await r.json();
   const values=role==='admin'?(await sql('SELECT label,sizes,sku FROM product_variants WHERE product_id=$1',[saved.id])).rows:(await sql('SELECT variants FROM supplier_submissions WHERE id=$1',[saved.id])).rows[0].variants;
   assert.equal(values.length,2);assert.ok(values.every(v=>v.sizes.length===1&&v.sizes[0]==='ÚNICO'));
   let product=role==='admin'?(await sql('SELECT id,slug FROM products WHERE id=$1',[saved.id])).rows[0]:null;
   if(role==='supplier'){await reviewSupplierListing(admin,{id:saved.id,revision:saved.revision,decision:'approved',prices:Object.fromEntries(values.map(v=>[v.sku,12500]))});product=(await sql('SELECT id,slug FROM products WHERE name=$1',[name])).rows[0];}
   const catalog=await(await fetch(base+'/api/catalog?slug='+product.slug)).json();assert.equal(catalog.products.length,2);assert.equal(new Set(catalog.products.map(v=>v.slug)).size,1);
   const quote=await quoteCart([{sku:values[0].sku,size:'ÚNICO',qty:1}]);assert.equal(quote.total_cents,12500);
   console.log('[compact.qa.watch]',JSON.stringify({role,viewport,colors:values.map(v=>v.label),sizes:values.map(v=>v.sizes),publicModels:1,quote:quote.total_cents}));
   await ctx.close();
  }
 }
 console.log('[compact.qa] PASS watch-specific palette, unique size, both editors, actual persistence, approval and cart quote');



}finally{await browser?.close().catch(()=>{});server?.kill('SIGTERM');await db().end()}
