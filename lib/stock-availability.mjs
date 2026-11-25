// Quantidade desconhecida não equivale a estoque confirmado.
export function stockAllowsQuantity(mode,stock,quantity){
 if(!Number.isSafeInteger(quantity)||quantity<1)return false;
 if(mode==='availability')return true;
 return mode==='quantity'&&Number.isSafeInteger(stock)&&stock>=quantity;
}
