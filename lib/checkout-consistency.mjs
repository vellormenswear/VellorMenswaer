import {stockAllowsQuantity} from './stock-availability.mjs';
// Called only after all saleable variant rows and product/supplier owners are locked.
export function validateReservedQuote(groups,rows){
 const fresh=new Map(rows.map(v=>[v.id,v])),quantities=new Map();
 for(const group of groups){
  for(const item of group.items){
   const v=fresh.get(item.variant_id);
   if(!v||!v.active||!v.supplier_available||v.supplier_id!==group.supplier_id||
      v.price_cents!==item.unit_cents||(v.pix_unit_cents??v.price_cents)!==(item.pix_unit_cents??item.unit_cents)||v.supplier_cost_cents!==item.cost_cents||
      v.stock_mode!==item.stock_mode||v.sku!==item.sku||v.label!==item.variant||v.name!==item.name||
      (v.preparation_days||2)!==item.preparation_days||
      (v.delivery_days_min||5)!==item.delivery_days_min||
      (v.delivery_days_max||15)!==item.delivery_days_max||
      !Array.isArray(v.sizes)||(v.sizes.length&&!v.sizes.includes(item.size)))return false;
   const qty=(quantities.get(v.id)||0)+item.qty;quantities.set(v.id,qty);
   if(!stockAllowsQuantity(v.stock_mode,v.stock,qty))return false;
  }
 }
 return quantities.size>0;
}
