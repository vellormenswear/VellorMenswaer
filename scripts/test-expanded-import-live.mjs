import assert from 'node:assert/strict';
import {readSupplierProduct} from '../lib/read-supplier-product.mjs';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='qa/importacao-ampliada-20261127')throw Error('Preview only');
const url='https://dawn-theme-default.myshopify.com/products/louise-slide-sandal';
const {product}=await readSupplierProduct(url);
assert.ok(product.name.toLowerCase().includes('louise'),'Expected public demo product');
assert.ok(product.photos.length,'Expected at least one public photo');
assert.ok(product.variants.every(v=>!Object.hasOwn(v,'price')&&!Object.hasOwn(v,'cost_cents')));
console.log('[expanded-import.live] PASS: real Shopify demonstration listing, name, image and '+product.variants.length+' explicit combinations; incomplete='+product.variants_incomplete);
