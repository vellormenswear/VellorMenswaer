// Legacy quantity is interpreted only as a yes/no state; never as a purchase limit.
export function stockAllowsQuantity(mode,stock,quantity){
 if(!Number.isSafeInteger(quantity)||quantity<1)return false;
 return mode==='availability'||(mode==='quantity'&&Number.isSafeInteger(stock)&&stock>0);
}
export function variantAvailable(v){
 return v?.supplier_available!==false&&stockAllowsQuantity(v?.stock_mode??'quantity',v?.stock==null||v.stock===''?null:Number(v.stock),1);
}
export function availabilityFields(v){
 return {stock_mode:'availability',stock:null,supplier_available:variantAvailable(v)};
}
