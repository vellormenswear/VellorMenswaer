import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PDFDocument} from 'pdf-lib';import {createShippingLabel,labelSize,shipmentBarcode,shippingLogoPng,shippingHeaderPng} from '../lib/shipping-label.mjs';
test('etiqueta real PDF com formato térmico e A4, código estável por remessa',async()=>{const group={id:'24681012-1234-4567-8901-123456789012',order_number:123,created_at:'2026-11-25T12:00:00Z',recipient_snapshot:{recipient:'Pessoa de Teste',street:'Rua de Teste',number:'10',city:'Rio de Janeiro',state:'RJ',cep:'00000000'}};const input={group,items:[{quantity:2,product_name_snapshot:'Camiseta teste',sku_snapshot:'SKU-TESTE',size_snapshot:'M'}],identity:{legal_name:'VELLOR WEAR'}};assert.equal(shipmentBarcode(group.id),'24681012123445678901123456789012');for(const format of ['thermal','a4']){const pdf=await PDFDocument.load(await createShippingLabel({...input,format}));assert.equal(pdf.getPageCount(),1);const page=pdf.getPage(0);const [w,h]=labelSize(format);assert.ok(Math.abs(page.getWidth()-w)<0.01);assert.ok(Math.abs(page.getHeight()-h)<0.01);}});
test('etiqueta exige pagamento confirmado e fornecedor titular',()=>{const s=readFileSync('app/api/shipping-label/route.js','utf8');assert.match(s,/requireRole\(req,\['admin','super_admin','supplier'\]/);assert.match(s,/p\.provider='infinitepay' AND p\.status='approved'/);assert.match(s,/s\.user_id=\$3/);assert.match(s,/private, no-store/);assert.doesNotMatch(s,/INSERT INTO|UPDATE supplier_order_groups/);});

import sharp from 'sharp';
test('etiqueta utiliza a composição exata da logo padrão do cabeçalho, sem tema masculino ou feminino',async()=>{
 const header=readFileSync('public/vitrine.html','utf8'),css=readFileSync('public/vellor-approved.css','utf8');
 assert.match(header,/class="vellor-fixed-logo"[^>]+src="\/logo-vellor\.png"/);
 assert.match(header,/class="vellor-wear-logo"[^>]+src="\/logo-vellor-wear\.svg"/);
 assert.match(css,/38\.4% 74\.57%/);
 const raw=src=>sharp(src).resize(1250,295,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 const fixed=await raw('public/logo-vellor.png'),wear=await raw('public/logo-vellor-wear.svg');
 const actual=await raw(await shippingLogoPng(1250));
 let wearVisible=0;
 for(let row=0;row<295;row++){
  const start=row*1250*4,end=start+1250*4,split=start+480*4;
  assert.deepEqual(actual.subarray(start,row<220?end:split),fixed.subarray(start,row<220?end:split));
  if(row>=220){assert.deepEqual(actual.subarray(split,end),wear.subarray(split,end));for(let i=split+3;i<end;i+=4)if(wear[i]>0)wearVisible++;}
 }
 assert.ok(wearVisible>100,'A camada WEAR precisa ser visível na rasterização');
});

test('faixa da etiqueta usa o degradê institucional padrão e preserva o corpo branco',async()=>{
 const css=readFileSync('public/vellor-approved.css','utf8');
 assert.match(css,/linear-gradient\(90deg,var\(--season-left,#10362c\) 0%,var\(--season-mid,#242326\) 50%,var\(--season-right,#401328\) 100%\)/);
 const {data,info}=await sharp(await shippingHeaderPng()).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const pixel=x=>Array.from(data.subarray(x*info.channels,x*info.channels+3));
 for(const [x,expected] of [[0,[16,54,44]],[625,[36,35,38]],[1249,[64,19,40]]])assert.ok(pixel(x).every((v,i)=>Math.abs(v-expected[i])<=1));
 const source=readFileSync('lib/shipping-label.mjs','utf8');assert.ok(source.indexOf('page.drawImage(header,')<source.indexOf('page.drawImage(logo,'));assert.match(source,/color:rgb\(0,0,0\)/);
});
