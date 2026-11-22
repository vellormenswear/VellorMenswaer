// Validacoes puras: nenhum resultado do navegador pode aprovar pagamentos.
export function toCents(value){
 if(value===null||value===undefined)return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*100))?Math.round(n*100):null;
}
export function preferenceIntegrity(pref,group){
 if(!pref||String(pref.id||'')!==String(group.preference_id||''))return 'PREFERENCE_ID_MISMATCH';
 if(String(pref.collector_id||'')!==String(group.provider_user_id||''))return 'PREFERENCE_COLLECTOR_MISMATCH';
 if(pref.external_reference!==undefined&&pref.external_reference!==null&&
  String(pref.external_reference)!==String(group.id))return 'PREFERENCE_REFERENCE_MISMATCH';
 if(!Array.isArray(pref.items)||!pref.items.length)return 'PREFERENCE_ITEMS_MISSING';
 const total=pref.items.reduce((sum,i)=>{
  if(i.currency_id&&i.currency_id!=='BRL')return NaN;
  if(!Number.isSafeInteger(Number(i.quantity))||Number(i.quantity)<1)return NaN;
  const cents=toCents(i.unit_price);
  return sum+(cents===null?NaN:cents*Number(i.quantity));
 },0);
 if(!Number.isSafeInteger(total)||total!==Number(group.amount_cents))return 'PREFERENCE_AMOUNT_MISMATCH';
 if(pref.marketplace_fee!==null&&pref.marketplace_fee!==undefined&&
   toCents(pref.marketplace_fee)!==Number(group.marketplace_fee_cents))return 'PREFERENCE_FEE_MISMATCH';
 return null;
}
export function paymentIntegrity(payment,group,live){
 if(!payment||!/^[0-9]{5,30}$/.test(String(payment.id||'')))return 'PAYMENT_ID_INVALID';
 if(String(payment.external_reference||'')!==String(group.id))return 'PAYMENT_REFERENCE_MISMATCH';
 if(String(payment.collector_id||'')!==String(group.provider_user_id||''))return 'PAYMENT_COLLECTOR_MISMATCH';
 if(payment.currency_id!=='BRL')return 'PAYMENT_CURRENCY_MISMATCH';
 if(toCents(payment.transaction_amount)!==Number(group.amount_cents))return 'PAYMENT_AMOUNT_MISMATCH';
 if(payment.live_mode!==live)return 'PAYMENT_ENVIRONMENT_MISMATCH';
 if(payment.marketplace_fee!==undefined&&payment.marketplace_fee!==null&&
   toCents(payment.marketplace_fee)!==Number(group.marketplace_fee_cents))return 'PAYMENT_FEE_MISMATCH';
 return null;
}
export function paymentCandidates({payments={},merchantOrders={},group={},limit=5}={}){
 const ids=new Set();
 const add=id=>{if(/^[0-9]{5,30}$/.test(String(id||'')))ids.add(String(id))};
 add(group.provider_payment_id);
 const found=Array.isArray(payments?.results)?payments.results:[];
 for(const p of found)if(String(p.external_reference||'')===String(group.id))add(p.id);
 const mo=Array.isArray(merchantOrders?.elements)?merchantOrders.elements:[];
 for(const order of mo){
  if(String(order.preference_id||'')!==String(group.preference_id||''))continue;
  for(const p of Array.isArray(order.payments)?order.payments:[])add(p.id);
 }
 return [...ids].slice(0,Math.min(5,Math.max(1,limit)));
}
export function safeProviderCode(value){
 const s=String(value||'');
 return /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(s)?s:null;
}
