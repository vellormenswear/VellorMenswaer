import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=process.cwd();const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/catalogo-nacional.json'),'utf8'));
test('104 anúncios são nacionais e têm SKU único',()=>{assert.equal(catalog.length,104);assert.equal(new Set(catalog.map(p=>p.sku)).size,104);assert.ok(catalog.every(p=>p.shipping==='nacional'));assert.equal(new Set(catalog.map(p=>p.slug)).size,35)});
test('preços pendentes permanecem pendentes; fotos originais existentes',()=>{assert.deepEqual(catalog.filter(p=>p.price_brl===null).map(p=>p.sku),['BINBOND-B1885-01','BINBOND-B1885-02','BINBOND-B1885-03']);for(const p of catalog){if(p.image_url)assert.ok(fs.existsSync(path.join(root,'public',p.image_url.replace(/^\//,''))),`Faltando ${p.image_url}`)}});
test('HTML preservado e responsivo, com ponte para checkout',()=>{const html=fs.readFileSync(path.join(root,'public/vitrine.html'),'utf8');const css=fs.readFileSync(path.join(root,'public/vellor-approved.css'),'utf8');assert.ok(css.includes('@media(max-width:620px)'));assert.ok(html.includes('vellor-approved.js'));assert.ok(html.includes('vellor-approved.css'));assert.ok(html.includes('VELLOR MENSWEAR'));assert.ok(!fs.existsSync(path.join(root,'docs/HTML-ORIGINAL-APROVADO.html')))});

test('vitrine sem pedidos fictícios e sem anúncios sem fotografia ou preço',()=>{const html=fs.readFileSync(path.join(root,'public/vitrine.html'),'utf8');const js=fs.readFileSync(path.join(root,'public/storefront.js'),'utf8');assert.ok(!html.includes('DEMO10'));assert.ok(!html.includes('PAINEL ADM DE TESTE'));assert.ok(!html.includes('SIMULAR PEDIDO'));assert.ok(!js.includes('placeDemoOrder'));assert.ok(!js.includes('showAdmin'));assert.equal(catalog.filter(x=>x.public_ready).length,101);assert.equal(catalog.filter(x=>!x.image_verified).length,0);assert.equal(catalog.filter(x=>x.reference_photo).length,13);assert.ok(catalog.filter(x=>x.price_brl===null).every(x=>!x.public_ready))});


test('13 ofertas 1/2 Dry Fit usam fotos do Drive apenas como referência de cores',()=>{
  const refs=catalog.filter(x=>x.reference_photo);
  assert.equal(refs.length,13);
  for(const a of refs){
    assert.equal(a.reference_photo_units,4);
    assert.ok([1,2].includes(a.quantity));
    assert.ok(a.photo_disclaimer?.includes(`esta oferta contém ${a.quantity} unidade`));
    assert.ok(fs.existsSync(path.join(root,'public',a.image_url.slice(1))));
  }
});


test('rodape aprovado inclui FAQ, pagamento sem bandeiras inventadas e contato humano',()=>{
 const html=fs.readFileSync(path.join(root,'public/vitrine.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'public/vellor-approved.css'),'utf8');
 const chatjs=fs.readFileSync(path.join(root,'public/vellor-support.js'),'utf8');
 assert.match(html,/id="vellor-faq-heading"/);
 assert.equal((html.match(/<details>/g)||[]).length,6);
 assert.match(html,/Pix e cartões Visa, Mastercard, Elo e American Express/);
 for(const marca of ['Pix','Visa','Mastercard','Elo','American Express','InfinitePay'])assert.ok(html.includes('alt="'+marca+'"'));
 assert.ok(html.includes('cdn.prod.website-files.com'));
 assert.ok(!html.includes('alt="Hipercard"'));
 assert.match(html,/Opções e condições de pagamento confirmadas no checkout da InfinitePay/);
 assert.match(html,/id="vellor-support-toggle"/);
 assert.match(html,/vellor-support\.js\?v=20261123-final-chat/);
 assert.match(html,/vellor-support\.css\?v=20261123-chat-circular/);
 assert.match(css,/\.vellor-footer-faq/);
 assert.ok(chatjs.includes('/api/support/chat'));
 assert.ok(fs.existsSync(path.join(root,'public/vellor-support.css')));
});
