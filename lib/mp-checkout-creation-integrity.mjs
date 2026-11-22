// Validação da resposta oficial da API antes de disponibilizar um checkout.
// Não inferir ambiente de teste pelo prefixo APP_USR ou por live_mode:
// Checkout Pro usa credenciais APP_USR do vendedor de teste e init_point.
export function cents(value){
 if(value===undefined||value===null)return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*100))?Math.round(n*100):null;
}
function itemsTotal(items){
 if(!Array.isArray(items)||!items.length)return null;
 let total=0;
 for(const item of items){
  const quantity=Number(item?.quantity),price=cents(item?.unit_price);
  if(!Number.isSafeInteger(quantity)||quantity<1||price===null||
     (item.currency_id&&item.currency_id!=='BRL'))return null;
  total+=quantity*price;
  if(!Number.isSafeInteger(total))return null;
 }
 return total;
}
export function checkoutCreationIntegrity({preference,request,sellerId,clientId}={}){
 const p=preference||{},q=request||{};
 const expectedAmount=itemsTotal(q.items);
 const actualAmount=itemsTotal(p.items);
 const expectedFee=cents(q.marketplace_fee??0);
 const actualFee=cents(p.marketplace_fee??0);
 let code=null;
 if(!p.id)code='PREFERENCE_ID_MISSING';
 else if(!/^\d+$/.test(String(sellerId||'')))code='SELLER_ID_UNVERIFIED';
 else if(String(p.collector_id||'')!==String(sellerId))code='PREFERENCE_COLLECTOR_MISMATCH';
 else if(p.client_id!==undefined&&p.client_id!==null&&String(clientId||'')&&
         String(p.client_id)!==String(clientId))code='PREFERENCE_APPLICATION_MISMATCH';
 else if(q.external_reference!==undefined&&String(p.external_reference||'')!==String(q.external_reference))code='PREFERENCE_REFERENCE_MISMATCH';
 else if(expectedAmount===null||actualAmount!==expectedAmount)code='PREFERENCE_AMOUNT_MISMATCH';
 else if(expectedFee===null||actualFee!==expectedFee)code='PREFERENCE_FEE_MISMATCH';
 else if(q.payer?.email&&p.payer?.email&&
         String(p.payer.email).toLowerCase()!==String(q.payer.email).toLowerCase())code='PREFERENCE_PAYER_MISMATCH';
 return {
  ok:code===null,code,
  checks:{
   seller_verified:!!sellerId&&String(p.collector_id||'')===String(sellerId),
   application_verified:p.client_id===undefined||p.client_id===null?null:
    String(p.client_id)===String(clientId),
   item_total_matches:expectedAmount!==null&&actualAmount===expectedAmount,
   marketplace_fee_matches:expectedFee!==null&&actualFee===expectedFee,
   reference_matches:q.external_reference===undefined?null:
    String(p.external_reference||'')===String(q.external_reference),
   payer_matches:q.payer?.email&&p.payer?.email?
    String(p.payer.email).toLowerCase()===String(q.payer.email).toLowerCase():null,
   provider_live_mode:typeof p.live_mode==='boolean'?p.live_mode:null
  }
 };
}
