import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
if(process.env.VERCEL_ENV==='preview'&&['vellor-stability-qa-20261125','vellor-departamentos-qa-20261125'].includes(process.env.VERCEL_GIT_COMMIT_REF)){
 const {db,sql}=await import('../lib/db.js');
 try{
  const marker=(await sql("SELECT p.category_id,p.supplier_id,u.id AS actor FROM products p CROSS JOIN users u WHERE p.slug='qa-vellor-homologacao-20261125' AND u.email='qa-vellor-20261125-admin@example.invalid'")).rows;
  assert.equal(marker.length,1,'Banco QA exclusivo não identificado; teste interrompido antes de qualquer gravação.');
  const {saveAdminListing}=await import('../lib/admin-catalog-service.js');
  const {quoteCart}=await import('../lib/commerce.js');
  const {category_id,supplier_id,actor}=marker[0],u={id:actor};
  const slug='qa-editor-'+randomUUID();
  const product={name:'QA editor calçado',slug,description:'Teste isolado',category_id,supplier_id,department:'masculino',shipping:'nacional',active:true,hidden:false};
  const photos=['/product-images/sem-foto.svg'];
  const variant={label:'Preto',supplier_cost_cents:6000,price_cents:10000,stock:4,stock_mode:'quantity',sizes:['39'],active:true,supplier_available:true,image_url:photos[0]};
  const invalid={...variant,label:'Inválida',sizes:['PP']};
  await assert.rejects(saveAdminListing(u,{product,photos,variants:[variant,invalid]}),/numeração/);
  assert.equal((await sql('SELECT 1 FROM products WHERE slug=$1',[slug])).rowCount,0,'Produto parcialmente gravado');
  console.log('[listing.qa] rollback de cadastro parcial aprovado');
  const saved=await saveAdminListing(u,{product,photos,variants:[variant,{...variant,label:'Azul',stock:0,sizes:['40']}]});
  assert.equal(saved.published,true);
  const rows=(await sql('SELECT id,sku,label,stock FROM product_variants WHERE product_id=$1 ORDER BY label',[saved.id])).rows;
  assert.equal(rows.length,2);assert.equal(new Set(rows.map(v=>v.sku)).size,2);
  const black=rows.find(v=>v.label==='Preto'),blue=rows.find(v=>v.label==='Azul');
  const q=await quoteCart([{sku:black.sku,qty:1,size:'39'}]);assert.equal(q.total_cents,10000);
  await assert.rejects(quoteCart([{sku:blue.sku,qty:1,size:'40'}]),/indisponível/);
  console.log('[listing.qa] cadastro, vitrine, SKU e cotação aprovados');
  await assert.rejects(saveAdminListing(u,{product:{...product,id:saved.id},photos,variants:[{...variant,id:black.id,price_cents:12000},{...invalid,id:blue.id}]}),/numeração/);
  assert.equal((await quoteCart([{sku:black.sku,qty:1,size:'39'}])).total_cents,10000);
  const edited=await saveAdminListing(u,{product:{...product,id:saved.id},photos,variants:[{...variant,id:black.id,price_cents:12000},{...variant,id:blue.id,label:'Azul',stock:0,sizes:['40']}]});
  assert.equal(edited.published,true);assert.equal((await quoteCart([{sku:black.sku,qty:1,size:'39'}])).total_cents,12000);
  const after=(await sql('SELECT sku FROM product_variants WHERE id=$1',[black.id])).rows[0];assert.equal(after.sku,black.sku);
  console.log('[listing.qa] edição, SKU preservado e rollback de edição aprovados');
  const single=await saveAdminListing(u,{product:{...product,department:'feminino',slug:'qa-editor-'+randomUUID()},photos,variants:[{...variant,label:''}]});
  assert.equal(single.published,true);
  const only=(await sql('SELECT sku,label FROM product_variants WHERE product_id=$1',[single.id])).rows;
  assert.equal(only.length,1);assert.equal(only[0].label,'Variação única');assert.equal((await quoteCart([{sku:only[0].sku,qty:1,size:'39'}])).total_cents,10000);
  assert.equal((await sql('SELECT department FROM products WHERE id=$1',[single.id])).rows[0].department,'feminino');assert.equal((await sql('SELECT department FROM products WHERE id=$1',[saved.id])).rows[0].department,'masculino');
  console.log('[listing.qa] departamentos persistidos corretamente');
  console.log('[listing.qa] variação única automática com tamanho e cotação aprovada');
  if((await sql("SELECT to_regclass('public.store_campaigns') AS table_name")).rows[0].table_name){
   const {CAMPAIGN_JOIN,CAMPAIGN_PRICE}=await import('../lib/campaign-pricing.mjs');
   const {CATALOG_FROM,CATALOG_WHERE}=await import('../lib/catalog-query.mjs');
   const campaign=(await sql("INSERT INTO store_campaigns(name,theme,starts_at,ends_at,enabled,decoration,store_bps,product_discounts,created_by) VALUES($1,'natal',now()-interval '1 minute',now()+interval '5 minutes',true,false,1000,$2,$3) RETURNING id",['QA campaign '+randomUUID(),JSON.stringify({[saved.id]:2000}),actor])).rows[0];
   try{
    const discounted=await quoteCart([{sku:black.sku,qty:1,size:'39'}]);assert.equal(discounted.total_cents,9600);
    const global=await quoteCart([{sku:only[0].sku,qty:1,size:'39'}]);assert.equal(global.total_cents,9000);
    const locked=(await sql("SELECT v.price_cents AS original_price_cents,("+CAMPAIGN_PRICE+") AS final_cents,v.supplier_cost_cents "+CATALOG_FROM+" "+CAMPAIGN_JOIN+" WHERE "+CATALOG_WHERE+" AND v.sku=$1",[black.sku])).rows[0];assert.equal(locked.original_price_cents,12000);assert.equal(locked.final_cents,9600);assert.equal(locked.supplier_cost_cents,6000);
    await sql("UPDATE store_campaigns SET store_bps=9000,product_discounts='{}' WHERE id=$1",[campaign.id]);assert.equal((await quoteCart([{sku:black.sku,qty:1,size:'39'}])).total_cents,12000);
    await sql("UPDATE store_campaigns SET store_bps=1000,ends_at=now()-interval '1 second',starts_at=now()-interval '2 minutes' WHERE id=$1",[campaign.id]);assert.equal((await quoteCart([{sku:black.sku,qty:1,size:'39'}])).total_cents,12000);
    console.log('[campaign.qa] desconto geral, individual, custo, proteção financeira e expiração aprovados');
   }finally{await sql('UPDATE store_campaigns SET enabled=false WHERE id=$1',[campaign.id]);}
  }
 }finally{await db().end();}
}else console.log('[listing.qa] testes de gravação restritos à prévia QA');
