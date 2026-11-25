import {createHash} from 'node:crypto';
export function checkoutRequestHash(input){
 if(!Array.isArray(input.items)||input.items.length<1||input.items.length>30)throw Error('Carrinho inválido');
 const items=input.items.map(item=>{
  if(!item||typeof item.sku!=='string'||!item.sku||item.sku.length>120||!Number.isInteger(Number(item.qty))||Number(item.qty)<1||Number(item.qty)>10)throw Error('Item inválido');
  return [item.sku,String(item.size||'').trim().slice(0,30),Number(item.qty)];
 });
 items.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return createHash('sha256').update(JSON.stringify([String(input.address_id).toLowerCase(),String(input.coupon||'').trim().toUpperCase(),input.expected_total_cents??null,items])).digest('hex');
}
export function couponHasCapacity(coupon,held=0){
 return Number.isSafeInteger(held)&&held>=0&&Number.isSafeInteger(coupon?.used_count)&&coupon.used_count>=0&&(coupon.max_uses===null||(Number.isSafeInteger(coupon.max_uses)&&coupon.used_count+held<coupon.max_uses));
}
