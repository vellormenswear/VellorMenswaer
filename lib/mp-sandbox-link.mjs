// Valida URLs exatas fornecidas pela API do Mercado Pago; nunca montar ou reescrever links.
export function validateSandboxCheckoutUrl(value){
 if(typeof value!=='string')return null;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  if(!['sandbox.mercadopago.com.br','sandbox.mercadopago.com'].includes(url.hostname.toLowerCase()))return null;
  return value;
 }catch{return null}
}
export function preferenceMatchesGroup(pref,{id,collectorId,amountCents,marketplaceFeeCents,payerEmail}={}){
 if(!pref||String(pref.id||'')!==String(id||''))return false;
 if(String(pref.collector_id||'')!==String(collectorId||''))return false;
 if(String(pref.payer?.email||'').toLowerCase()!==String(payerEmail||'').toLowerCase())return false;
 if(!Array.isArray(pref.items)||!pref.items.length)return false;
 const total=Math.round(pref.items.reduce((n,i)=>n+Number(i.unit_price||0)*Number(i.quantity||0),0)*100);
 const fee=Math.round(Number(pref.marketplace_fee||0)*100);
 return Number.isSafeInteger(amountCents)&&total===amountCents&&
  Number.isSafeInteger(marketplaceFeeCents)&&fee===marketplaceFeeCents;
}
