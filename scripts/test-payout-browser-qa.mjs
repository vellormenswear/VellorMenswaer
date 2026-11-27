import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='qa/auditoria-duplicidades-20261127'||!process.env.QA_PAYOUT_DATABASE_URL)throw Error('Isolated browser QA required');
process.env.DATABASE_URL=process.env.QA_PAYOUT_DATABASE_URL;
const {db,sql,transaction}=await import('../lib/db.js');
const fake='qa-payout-browser-'+randomUUID(),tokens={};
const base='http://127.0.0.1:4179';let server,browser;
async function accountPage(role,viewport,path){
 const context=await browser.newContext({viewport,deviceScaleFactor:1});
 await context.addCookies([{name:'pg_goston_sid',value:tokens[role],url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();
 page.on('pageerror',e=>console.log('[browser.pageerror]',e.message.slice(0,200)));
 page.on('requestfailed',r=>console.log('[browser.failed]',new URL(r.url()).pathname,r.failure()?.errorText));
 page.on('response',r=>{if(r.url().includes('/api/'))console.log('[browser.api]',new URL(r.url()).pathname,r.status());});
 page.on('console',m=>{if(m.type()==='error')console.log('[browser.console]',m.text().slice(0,200));});
 const r=await page.goto(base+path,{waitUntil:'domcontentloaded'});console.log('[browser.page]',path.split('?')[0],r?.status(),page.url());
 return {context,page};
}
async function visible(locator,timeout=20000){await locator.waitFor({state:'visible',timeout});}
try{
 const marker=(await sql("SELECT p.id,p.supplier_id,s.user_id AS supplier_user,u.id AS admin,pix.updated_at FROM products p JOIN suppliers s ON s.id=p.supplier_id JOIN supplier_pix_accounts pix ON pix.supplier_id=s.id CROSS JOIN users u WHERE p.slug='qa-vellor-homologacao-20261125' AND u.email='qa-vellor-20261125-admin@example.invalid'")).rows;
 assert.equal(marker.length,1,'QA marker absent: no writes allowed');const qa=marker[0];
 const qaSupplier=randomUUID(),qaOtherSupplier=randomUUID();
 const ids={admin:qa.admin,superadmin:randomUUID(),supplier:randomUUID(),other:randomUUID(),customer:randomUUID(),otherCustomer:randomUUID()};
 const order=randomUUID(),group=randomUUID(),item=randomUUID(),img='/product-images/sem-foto.svg',reference='QA-'+randomUUID();
 const recipient={recipient:'Destinatário fictício QA',street:'Rua Exemplo',number:'100',complement:'Apto 2',neighborhood:'Centro',city:'Rio de Janeiro',state:'RJ',cep:'00000000'};
 await transaction(async c=>{
  for(const [role,id,supplierId] of [['supplier',ids.supplier,qaSupplier],['other',ids.other,qaOtherSupplier]]){
   await c.query("INSERT INTO users(id,full_name,email,password_hash,role) VALUES($1,'Fornecedor fictício QA',$2,$3,'supplier')",[id,role+'-'+fake+'@example.invalid',randomUUID()]);
   await c.query("INSERT INTO suppliers(id,user_id,business_name,document_number,status) VALUES($1,$2,'Fornecedor fictício QA',$3,'active')",[supplierId,id,'QA-'+randomUUID()]);
  }
  const pix=(await c.query("INSERT INTO supplier_pix_accounts(supplier_id,pix_type,pix_key,holder_name) VALUES($1,'random',$2,'Fornecedor fictício QA') RETURNING updated_at",[qaSupplier,randomUUID()])).rows[0];qa.updated_at=pix.updated_at;
  for(const role of ['customer','otherCustomer'])await c.query("INSERT INTO users(id,full_name,email,password_hash,role) VALUES($1,'Cliente fictício QA',$2,$3,'customer')",[ids[role],role+'-'+fake+'@example.invalid',randomUUID()]);
  await c.query("INSERT INTO users(id,full_name,email,password_hash,role) VALUES($1,'Super ADM fictício QA',$2,$3,'super_admin')",[ids.superadmin,'super-'+fake+'@example.invalid',randomUUID()]);
  for(const [role,id] of Object.entries(ids)){const token=randomBytes(32).toString('hex');tokens[role]=token;await c.query("INSERT INTO sessions(user_id,token_hash,expires_at,user_agent) VALUES($1,$2,now()+interval '10 minutes',$3)",[id,createHash('sha256').update(token).digest('hex'),fake]);}
  await c.query("INSERT INTO orders(id,order_number,customer_id,recipient_snapshot,subtotal_cents,total_cents,status,payment_status,paid_at) VALUES($1,(SELECT COALESCE(max(order_number),0)+1 FROM orders),$2,$3,250,250,'paid','approved',now())",[order,ids.customer,JSON.stringify(recipient)]);
  await c.query("INSERT INTO payments(order_id,amount_cents,provider,status,environment,payment_method) VALUES($1,250,'infinitepay','approved','sandbox','pix')",[order]);
  await c.query("INSERT INTO supplier_order_groups(id,order_id,supplier_id,amount_cents,supplier_amount_cents,marketplace_fee_cents,payment_status,fulfillment_status,paid_at) VALUES($1,$2,$3,250,200,50,'approved','awaiting_payout',now())",[group,order,qaSupplier]);
  await c.query("INSERT INTO order_items(id,order_id,variant_id,sku_snapshot,product_name_snapshot,variant_snapshot,size_snapshot,image_url_snapshot,quantity,unit_price_cents,line_total_cents) VALUES($1,$2,$3,'QA-SKU','Produto fictício QA','Amarelo','33',$4,1,250,250)",[item,order,null,img]);
  await c.query("INSERT INTO supplier_order_items(group_id,order_item_id,variant_id,sku_snapshot,size_snapshot,quantity,unit_cost_cents,supplier_line_cents) VALUES($1,$2,$3,'QA-SKU','33',1,200,200)",[group,item,null]);
  await c.query("INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,'supplier_payment_pending','QA pagamento do cliente',$2)",[order,JSON.stringify({group_id:group,supplier_id:qaSupplier})]);
 });
 await sql("UPDATE suppliers SET address_text='Rua Exemplo, 100, Centro, Rio de Janeiro/RJ' WHERE id=$1",[qaSupplier]);
 const orderNo=(await sql('SELECT order_number FROM orders WHERE id=$1',[order])).rows[0].order_number;
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','4179','-H','127.0.0.1'],{env:{...process.env,DATABASE_URL:process.env.QA_PAYOUT_DATABASE_URL},stdio:'ignore'});
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}if(i===59)throw Error('QA Next server unavailable');await new Promise(r=>setTimeout(r,500));}
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(x=>x!=='--single-process'),headless:true});
 const desktop={width:1440,height:900},mobile={width:390,height:844};
 const expectedGradient='linear-gradient(90deg, rgb(16, 54, 44), rgb(36, 35, 38) 50%, rgb(64, 19, 40))';
 const gradient=async locator=>{await visible(locator);assert.equal(await locator.evaluate(el=>getComputedStyle(el).backgroundImage),expectedGradient);};
 for(const role of ['admin','superadmin','supplier','customer']){
 const account=await accountPage(role,desktop,'/conta');
 for(const viewport of [desktop,mobile]){
  await account.page.setViewportSize(viewport);
  await gradient(account.page.locator('.app-profile'));
  await gradient(account.page.getByRole('button',{name:'SALVAR DADOS',exact:true}));
  await gradient(account.page.getByRole('button',{name:'ALTERAR SENHA',exact:true}));
  if(role!=='customer')await gradient(account.page.locator('.vll-account-app .navtabs').getByRole('link',{name:role==='supplier'?'Portal do fornecedor':'Painel administrativo',exact:true}));
  assert.equal(await account.page.locator('.vll-account-app .navtabs button.active').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await account.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Account page overflow');
 }
 await account.context.close();
 }
 console.log('[account-brand.browser] PASS: actual authenticated account profile, buttons and shortcuts for ADM, Super ADM, supplier and customer at 1440px and 390px');
 const seller=await accountPage('supplier',desktop,'/fornecedor');
 try{await visible(seller.page.getByRole('button',{name:'Pedidos',exact:true}));}catch(e){console.log('[browser.body]',(await seller.page.locator('body').innerText()).slice(0,1800));throw e;}
 await gradient(seller.page.locator('.vll-supplier-app .navtabs button.active'));await seller.page.setViewportSize(mobile);await gradient(seller.page.locator('.vll-supplier-app .navtabs button.active'));await seller.page.setViewportSize(desktop);
 await seller.page.getByRole('button',{name:'+ Novo anúncio',exact:true}).click();
 await visible(seller.page.getByLabel('Disponibilidade',{exact:true}));assert.deepEqual(await seller.page.getByLabel('Disponibilidade',{exact:true}).locator('option').allTextContents(),['Disponível','Indisponível']);
 const shoeCategory=(await sql("SELECT id FROM categories WHERE slug='calcados' AND parent_id IS NULL")).rows[0].id;
 await seller.page.getByLabel('Categoria principal',{exact:true}).selectOption(shoeCategory);
 async function selectGrid(page){const colors=page.getByRole('group',{name:'Selecionar várias cores'}),sizes=page.getByRole('group',{name:'Selecionar vários tamanhos'});for(const c of ['Preto','Branco'])await colors.getByRole('button',{name:c,exact:true}).click();for(const s of ['39','40','41'])await sizes.getByRole('button',{name:s,exact:true}).click();await page.getByRole('button',{name:'Gerar 6 variações',exact:true}).click();}
 await selectGrid(seller.page);assert.equal(await seller.page.getByLabel('Estoque',{exact:true}).count(),6);await seller.page.getByLabel('Estoque',{exact:true}).first().fill('0');await seller.page.getByLabel('Estoque',{exact:true}).nth(1).fill('7');assert.equal(await seller.page.getByLabel('Disponibilidade',{exact:true}).first().inputValue(),'available');
 await seller.page.getByLabel('Disponibilidade',{exact:true}).nth(1).selectOption('unavailable');assert.equal(await seller.page.getByLabel('Estoque',{exact:true}).nth(1).inputValue(),'7');
 await seller.page.setViewportSize(mobile);assert.equal(await seller.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Supplier product editor overflows mobile');await seller.page.setViewportSize(desktop);
 console.log('[variant-grid.browser] PASS: supplier selected 2 colors and 3 sizes, six independent quantities, responsive form');
 console.log('[availability.browser] PASS: supplier form with color chips and binary selector');
 await seller.page.getByRole('button',{name:'Pedidos',exact:true}).click();
 await visible(seller.page.getByText('Produto fictício QA',{exact:true}));
 await visible(seller.page.getByText(/Aguardando Pix da VELLOR/));
 assert.equal(await seller.page.getByRole('link',{name:'Etiqueta A4'}).count(),0);
 const buyer=await accountPage('customer',desktop,'/conta');
 // Verify the actual authenticated address form without creating any checkout.
 await visible(buyer.page.getByRole('button',{name:'Meus endereços',exact:true}));
 await buyer.page.getByRole('button',{name:'Meus endereços',exact:true}).click();
 await buyer.page.getByRole('button',{name:'Adicionar endereço',exact:true}).click();
 await visible(buyer.page.getByLabel('CEP',{exact:true}));
 const address=buyer.page;
 assert.equal(await address.getByLabel('Destinatário',{exact:true}).inputValue(),'Cliente fictício QA');
 assert.equal(await address.getByLabel('Destinatário',{exact:true}).getAttribute('readonly'),'');
 await address.route('**/api/cep/01001000',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({cep:'01001000',street:'Praça da Sé',neighborhood:'Sé',city:'São Paulo',state:'SP'})}));
 await address.getByLabel('Complemento',{exact:true}).fill('Apto 304');await address.getByLabel('Número',{exact:true}).fill('123');await address.getByLabel('CEP',{exact:true}).fill('01001000');
 await address.waitForFunction(()=>document.querySelector('#street')?.value==='Praça da Sé');
 assert.equal(await address.getByLabel('Complemento',{exact:true}).inputValue(),'Apto 304');assert.equal(await address.getByLabel('Número',{exact:true}).inputValue(),'123');assert.equal(await address.getByLabel('Bairro',{exact:true}).inputValue(),'Sé');assert.equal(await address.getByLabel('Cidade',{exact:true}).inputValue(),'São Paulo');assert.equal(await address.getByLabel('UF',{exact:true}).inputValue(),'SP');
 await address.getByLabel('Entregar a terceiros').check();await address.getByLabel('Destinatário',{exact:true}).fill('Recebedor fictício QA');
 const [savedAddress]=await Promise.all([address.waitForResponse(r=>r.url().endsWith('/api/account/addresses')&&r.request().method()==='POST'),address.getByRole('button',{name:'SALVAR ENDEREÇO',exact:true}).click()]);assert.equal(savedAddress.status(),200,await savedAddress.text());
 await visible(address.getByText('Recebedor fictício QA',{exact:false}).first());
 console.log('[address.browser] PASS: autofill, complement and number preserved, actual recipient and third-party save in isolated QA');
 
 const admin=await accountPage('admin',desktop,'/admin?pedido='+order);
 await gradient(admin.page.locator('.vll-admin-app .sidebar'));await admin.page.setViewportSize(mobile);await gradient(admin.page.locator('.vll-admin-app .sidebar'));await admin.page.setViewportSize(desktop);
 const payout=admin.page.locator('section').filter({has:admin.page.getByRole('heading',{name:'Repasse ao fornecedor',exact:true})}).last();
 await visible(payout.getByRole('button',{name:'REGISTRAR PIX JÁ REALIZADO'}));
 await payout.locator('input').first().fill(reference);
 await payout.locator('textarea').first().fill('QA: comprovante fictício; nenhuma transferência real.');
 admin.page.once('dialog',d=>d.accept());
 const [result]=await Promise.all([admin.page.waitForResponse(r=>r.url().endsWith('/api/admin/infinitepay')&&r.request().method()==='POST',{timeout:20000}),payout.getByRole('button',{name:'REGISTRAR PIX JÁ REALIZADO'}).click()]);
 assert.equal(result.status(),200,await result.text());assert.equal((await result.json()).recorded,true);
 await visible(seller.page.getByText(/Repasse confirmado/).first(),12000);
 await visible(seller.page.getByText(/Destinatário fictício QA/));await visible(seller.page.getByRole('link',{name:'Etiqueta A4'}));
 await visible(seller.page.getByText(/Variação \/ cor: Amarelo/));await visible(seller.page.getByText(/Tamanho: 33/));
 const verifyLayout=async page=>{
  const img=page.getByRole('img',{name:'Produto fictício QA'});await visible(img);
  await page.waitForFunction(()=>[...document.images].some(i=>i.alt==='Produto fictício QA'&&i.complete&&i.naturalWidth>0),{},{timeout:20000});
  const bounds=await img.boundingBox();assert.ok(bounds.width>=60&&bounds.height>=60);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false,'Horizontal overflow');
  const label=page.getByRole('link',{name:'Etiqueta A4'});await visible(label);
  await label.scrollIntoViewIfNeeded();const box=await label.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=page.viewportSize().width+2);
 };
 await verifyLayout(seller.page);
 await admin.page.getByRole('button',{name:'Produtos',exact:true}).click();await visible(admin.page.getByRole('button',{name:'Novo produto',exact:true}));await admin.page.getByRole('button',{name:'Novo produto',exact:true}).click();
 const adminAvailability=admin.page.locator('label').filter({hasText:'Disponibilidade'}).locator('select');try{await visible(adminAvailability);}catch(e){console.log('[admin.editor.body]',(await admin.page.locator('body').innerText()).slice(0,3500));throw e;}assert.deepEqual(await adminAvailability.locator('option').allTextContents(),['Disponível','Indisponível']);await adminAvailability.selectOption('unavailable');assert.equal(await adminAvailability.inputValue(),'unavailable');await adminAvailability.selectOption('available');assert.equal(await adminAvailability.inputValue(),'available');
 assert.equal(await admin.page.getByText('Quantidade em estoque',{exact:true}).count(),0);
 await visible(admin.page.getByText('Foto da variação (opcional)',{exact:true}));
 await admin.page.getByLabel('Categoria principal',{exact:true}).selectOption(shoeCategory);await selectGrid(admin.page);
 const variantHeads=admin.page.getByRole('button',{name:/^(Preto|Branco) \/ (39|40|41)/});assert.equal(await variantHeads.count(),6);const stockField=admin.page.locator('label').filter({hasText:/^Estoque$/}).locator('input');await visible(stockField);await stockField.fill('9');assert.equal(await stockField.inputValue(),'9');await variantHeads.nth(1).click();await visible(stockField);assert.equal(await stockField.inputValue(),'');await variantHeads.first().click();await visible(stockField);assert.equal(await stockField.inputValue(),'9');
 await admin.page.setViewportSize(mobile);assert.equal(await admin.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Admin product editor overflows mobile');await admin.page.setViewportSize(desktop);
 console.log('[variant-grid.browser] PASS: admin generated six size-color rows, individual stock, photo preserved, responsive form');

 await seller.page.getByText('Produto fictício QA',{exact:true}).scrollIntoViewIfNeeded();
  const phone=await accountPage('supplier',mobile,'/fornecedor');
 await visible(phone.page.getByRole('button',{name:'Pedidos',exact:true}));await phone.page.getByRole('button',{name:'Pedidos',exact:true}).click();
 await visible(phone.page.getByText('Produto fictício QA',{exact:true}));await verifyLayout(phone.page);
 await phone.page.getByText('Produto fictício QA',{exact:true}).scrollIntoViewIfNeeded(); await phone.page.getByRole('button',{name:'Avisos',exact:false}).first().click();await visible(phone.page.getByText('REPASSE CONFIRMADO',{exact:true}));
 const finance=await accountPage('admin',desktop,'/admin?tab=reports');await finance.page.waitForURL('**/admin/financeiro?tab=reports');await visible(finance.page.getByRole('heading',{name:'Relatório comercial — 90 dias'}));const [reportResponse]=await Promise.all([finance.page.waitForResponse(r=>r.url().endsWith('/api/admin/reports')&&r.request().method()==='GET'),finance.page.getByRole('button',{name:'Atualizar dados'}).click()]);assert.equal(reportResponse.status(),200);await gradient(finance.page.locator('nav[aria-label="Seções financeiras"] button[aria-current="page"]'));await finance.page.setViewportSize(mobile);await gradient(finance.page.locator('nav[aria-label="Seções financeiras"] button[aria-current="page"]'));console.log('[brand.browser] PASS: exact storefront gradient computed in administrator, supplier and finance tabs at 1440px and 390px');assert.equal(await finance.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await finance.context.close();console.log('[finance.browser] PASS: canonical report navigation and refresh request, mobile overflow check');
 await phone.context.close();await admin.context.close();await buyer.context.close();await seller.context.close();
 console.log('[payout.browser] PASS: actual ADM confirmation, supplier live update without reload, product photo, details, labels and notice at 1440px and 390px, no horizontal overflow');
}finally{if(browser)await browser.close().catch(()=>{});if(server)server.kill();await db().end();}
