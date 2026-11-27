// Explicit supplier-facing field allowlist. Never expose retail prices, margin, fees or payment credentials.
export function supplierVariantView(v){
 const {id,key,sku,label,sizes,cost_cents,stock,stock_mode,supplier_available,reported_stock,image_url,preparation_days,delivery_days_min,delivery_days_max,active}=v;
 return {id,key,sku,label,sizes,cost_cents,stock,stock_mode,supplier_available,reported_stock,image_url,preparation_days,delivery_days_min,delivery_days_max,active};
}
export function supplierSubmissionView(s){return {...s,variants:Array.isArray(s.variants)?s.variants.map(supplierVariantView):[]};}
