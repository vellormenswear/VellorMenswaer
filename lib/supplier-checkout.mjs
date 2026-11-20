// Helpers puros do checkout Split 1:1, em valores inteiros (centavos).
export function discountedPreferenceItems(items,totalCents){
 const units=[];
 for(const line of items){
  if(!Number.isInteger(line.unit_cents)||line.unit_cents<1||!Number.isInteger(line.qty)||line.qty<1)throw Error('Item inválido');
  for(let n=0;n<line.qty;n++)units.push({id:line.sku,title:(line.name+' '+(line.variant||'')).trim().slice(0,190),quantity:1,currency_id:'BRL',unit_price:line.unit_cents});
 }
 let remaining=units.reduce((s,item)=>s+item.unit_price,0)-totalCents;
 if(!Number.isInteger(totalCents)||totalCents<1||remaining<0)throw Error('Total do grupo inválido');
 for(const item of units){let off=Math.min(item.unit_price-1,remaining);item.unit_price-=off;remaining-=off;if(remaining===0)break}
 if(remaining!==0)throw Error('Desconto do grupo não pode ser distribuído');
 return units.map(item=>({...item,unit_price:Number((item.unit_price/100).toFixed(2))}));
}
export function checkoutReady(env){
 const mode=env.MP_MODE;
 return ['sandbox','production'].includes(mode) && (mode==='sandbox'||env.MP_LIVE_ENABLED==='true') &&
 env.MP_SPLIT_ENABLED==='true'&&env.STORE_OPEN_FOR_ORDERS==='true'&&
 !!env.DATABASE_URL&&!!env.MP_CLIENT_ID&&!!env.MP_CLIENT_SECRET&&!!env.MP_TOKEN_ENCRYPTION_KEY&&
 !!env.MP_WEBHOOK_SECRET&&/^https:\/\//.test(env.SITE_URL||'');
}
export function paidStatus(payment){return payment?.status==='approved'&&payment?.status_detail!=='pending_contingency'}
