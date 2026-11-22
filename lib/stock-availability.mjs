// O modo availability representa disponibilidade sob consulta, nao quantidade de itens em estoque local.
export function stockAllowsQuantity(mode,stock,quantity){
 if(mode==='availability')return true;
 if(stock===null||stock===undefined)return true; // Preserva comportamento legado para estoque nao definido.
 return Number.isInteger(quantity)&&quantity>=1&&Number(stock)>=quantity;
}
