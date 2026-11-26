import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveApprovedProductImage,parseRetailPriceCents,MISSING_PRODUCT_IMAGE} from '../lib/marketplace-rules.mjs';

const backend=readFileSync('lib/supplier-listings.js','utf8');
const admin=readFileSync('app/admin/fornecedores/page.jsx','utf8');
const catalog=readFileSync('app/api/catalog/route.js','utf8');

test('aprovação aceita anúncio sem foto usando imagem explicitamente provisória',()=>{
 assert.equal(resolveApprovedProductImage(''),'/product-images/sem-foto.svg');
 assert.equal(resolveApprovedProductImage(null),MISSING_PRODUCT_IMAGE);
 assert.equal(resolveApprovedProductImage('https://cdn.example.org/produto.jpg'),'https://cdn.example.org/produto.jpg');
 assert.throws(()=>resolveApprovedProductImage('http://inseguro.example/img.jpg'),/HTTPS/);
 assert.match(readFileSync('public/product-images/sem-foto.svg','utf8'),/Imagem indisponível/);
 assert.match(backend,/const imageUrl=resolveApprovedProductImage\(v.image_url\)/);
 assert.match(backend,/supplierVariantValid\(\{\.\.\.v,image_url:imageUrl\}\)/);
 assert.match(backend,/v.sizes,imageUrl,/);
});

test('preço R$ 2 para custo R$ 1 é aceito; formato inválido dá erro legível',()=>{
 assert.equal(parseRetailPriceCents('2'),200);
 assert.equal(parseRetailPriceCents('2,00'),200);
 assert.equal(parseRetailPriceCents('2.50'),250);
 assert.throws(()=>parseRetailPriceCents(''),/preço de venda/);
 assert.throws(()=>parseRetailPriceCents('0'),/maior que zero/);
 assert.throws(()=>parseRetailPriceCents('abc'),/preço de venda/);
 assert.throws(()=>parseRetailPriceCents('2,999'),/preço de venda/);
});

test('aprovação exibe andamento, erro e confirmação junto ao produto analisado',()=>{
 assert.match(admin,/reviewSubmission\(s,'approved'\)/);
 assert.match(admin,/setReviewNotice\(/);
 assert.match(admin,/reviewNotice\[s.id\]\.text/);
 assert.match(admin,/aria-live="polite"/);
 assert.match(admin,/Sem foto — imagem provisória/);
});

test('catálogo continua exigindo imagem — placeholder garante visibilidade',()=>{
 assert.match(catalog,/COALESCE\(NULLIF\(NULLIF\(v.primary_image_url/);
 assert.equal(MISSING_PRODUCT_IMAGE.startsWith('/product-images/'),true);
});
