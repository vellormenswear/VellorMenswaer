import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
if(process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_GIT_COMMIT_REF==='vellor-stability-qa-20261125'){
 const {db,sql}=await import('../lib/db.js');
 try{
  const marker=(await sql("SELECT p.category_id,p.supplier_id,u.id AS actor FROM products p CROSS JOIN users u WHERE p.slug='qa-vellor-homologacao-20261125' AND u.email='qa-vellor-20261125-admin@example.invalid'")).rows;
  assert.equal(marker.length,1,'Banco QA exclusivo não identificado; teste interrompido antes de qualquer gravação.');
  const {saveAdminListing}=await import('../lib/admin-catalog-service.js');
  const {quoteCart}=await import('../lib/commerce.js');
  const {category_id,supplier_id,actor}=marker[0],u={id:actor};
  const slug='qa-editor-'+randomUUID();
  const product={name:'QA editor calçado',slug,description:'Teste isolado',category_id,supplier_id,shipping:'nacional',active:true,hidden:false};
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
  const single=await saveAdminListing(u,{product:{...product,slug:'qa-editor-'+randomUUID()},photos,variants:[{...variant,label:''}]});
  assert.equal(single.published,true);
  const only=(await sql('SELECT sku,label FROM product_variants WHERE product_id=$1',[single.id])).rows;
  assert.equal(only.length,1);assert.equal(only[0].label,'Variação única');assert.equal((await quoteCart([{sku:only[0].sku,qty:1,size:'39'}])).total_cents,10000);
  console.log('[listing.qa] variação única automática com tamanho e cotação aprovada');
 }finally{await db().end();}
}else console.log('[listing.qa] testes de gravação restritos à prévia QA');
