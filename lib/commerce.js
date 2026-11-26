import {CAMPAIGN_JOIN,CAMPAIGN_PRICE,CAMPAIGN_DISCOUNT} from '@/lib/campaign-pricing.mjs';
import {sql} from '@/lib/db';import {HttpError,ensure} from '@/lib/http';
import {stockAllowsQuantity} from '@/lib/stock-availability.mjs';
import {CATALOG_IMAGE,CATALOG_FROM,CATALOG_WHERE} from '@/lib/catalog-query.mjs';
export function money(cents){return Number(cents/100).toFixed(2)}
export function computeDiscount(subtotal,coupon){if(!coupon)return 0;let amount=coupon.discount_type==='percent'?Math.floor(subtotal*Number(coupon.amount)/10000):Number(coupon.amount);return Math.max(0,Math.min(amount,subtotal))}
export async function quoteCart(items,couponCode=''){
 ensure(Array.isArray(items)&&items.length>0&&items.length<=30,'Seu carrinho deve conter entre 1 e 30 itens.');
 const lines=[],skuSet=new Set(),requested=[];
 for(const item of items){
 ensure(item&&typeof item.sku==='string'&&item.sku.length>0&&item.sku.length<=120,'SKU inválido.');
 const sku=item.sku,qty=Number(item.qty),size=String(item.size||'').trim().slice(0,30),key=JSON.stringify([sku,size]);
 ensure(!skuSet.has(key),'Produtos repetidos no carrinho.');skuSet.add(key);
 ensure(Number.isInteger(qty)&&qty>=1&&qty<=10,'Quantidade inválida.');
 requested.push({sku,qty,size});
 }
 const skus=[...new Set(requested.map(i=>i.sku))];
 const r=await sql(`SELECT v.id,v.sku,v.label,(${CAMPAIGN_PRICE}) AS price_cents,${CAMPAIGN_DISCOUNT} AS promotion_discount_cents,v.original_price_cents,v.sizes,v.stock,v.stock_mode,v.active,v.supplier_available,v.supplier_cost_cents,${CATALOG_IMAGE} AS primary_image_url,p.name,p.shipping,p.active AS product_active,p.hidden ${CATALOG_FROM} ${CAMPAIGN_JOIN} WHERE ${CATALOG_WHERE} AND v.sku=ANY($1::text[])`,[skus]);
 const bySku=new Map(r.rows.map(p=>[p.sku,p])),quantities=new Map();
 for(const {sku,qty,size} of requested){
 const p=bySku.get(sku);ensure(p&&p.product_active&&p.active&&p.supplier_available&&!p.hidden&&p.shipping==='nacional','Produto indisponível no catálogo.',409);
 ensure(Number.isInteger(p.price_cents)&&p.price_cents>0&&Number.isInteger(p.supplier_cost_cents)&&p.supplier_cost_cents>0&&p.price_cents>p.supplier_cost_cents&&p.primary_image_url,'Produto indisponível para venda.',409);
 if(p.sizes.length)ensure(p.sizes.includes(size),'Escolha um tamanho disponível.',400);
 ensure(stockAllowsQuantity(p.stock_mode,p.stock,qty),'Quantidade maior que o estoque.',409);

 const totalQty=(quantities.get(p.id)||0)+qty;quantities.set(p.id,totalQty);
 ensure(stockAllowsQuantity(p.stock_mode,p.stock,totalQty),'Quantidade total maior que o estoque.',409);
 lines.push({sku,qty,size,variant_id:p.id,name:p.name,variant:p.label,unit_cents:p.price_cents,promotion_discount_cents:p.promotion_discount_cents,line_cents:qty*p.price_cents,image:p.primary_image_url});
 }
 const subtotal=lines.reduce((s,x)=>s+x.line_cents,0);let coupon=null;
 if(couponCode){const c=await sql(`SELECT * FROM coupons WHERE code=$1 AND active AND (starts_at IS NULL OR starts_at<=now()) AND (expires_at IS NULL OR expires_at>now())`,[String(couponCode).trim().toUpperCase()]);coupon=c.rows[0]||null;ensure(coupon,'Cupom inválido ou expirado.',400);ensure(subtotal>=coupon.min_subtotal_cents,'Valor mínimo não atingido.',400);ensure(coupon.max_uses===null||coupon.used_count<coupon.max_uses,'Cupom esgotado.',409)}
 const shipping=0; // Frete integrado no preço de fornecimento; não cobrar novamente no checkout.
 const discount=computeDiscount(subtotal,coupon);
 return {items:lines,subtotal_cents:subtotal,discount_cents:discount,shipping_cents:shipping,total_cents:shipping===null?null:subtotal-discount+shipping,coupon:coupon?{id:coupon.id,code:coupon.code,discount_type:coupon.discount_type}:null};
}
