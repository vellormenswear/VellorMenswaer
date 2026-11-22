// Prova isolada da Orders API: não cria pedidos VELLOR nem libera produtos.
export const CANARY_TITLE='Teste VELLOR Orders API';
export const CANARY_AMOUNT='20.00';
const referenceRE=/^vellor-orders-canary-(simple|split)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const orderIdValid=id=>typeof id==='string'&&/^ORDTST[A-Z0-9]{10,64}$/.test(id);
export function canaryOrderPayload(mode,reference){
 if(!['simple','split'].includes(mode)||!referenceRE.test(reference)||!reference.startsWith('vellor-orders-canary-'+mode+'-'))throw new Error('Modo ou referência de teste inválidos.');
 const payload={type:'online',processing_mode:'manual',total_amount:CANARY_AMOUNT,external_reference:reference,
  description:CANARY_TITLE,items:[{title:CANARY_TITLE,quantity:1,unit_price:CANARY_AMOUNT}]};
 if(mode==='split')payload.marketplace_fee='1.00';
 // Não definir payer: a Orders API admite checkout convidado, evitando cartão salvo/express.
 return payload;
}
const cents=value=>value===undefined||value===null?null:Number.isFinite(Number(value))?Math.round(Number(value)*100):null;
export function inspectCanaryOrder(order,{sellerId,clientId}={}){
 const reference=String(order?.external_reference||'');
 const match=referenceRE.exec(reference);
 const testId=orderIdValid(order?.id);
 const sellerMatch=String(order?.user_id||'')===String(sellerId||'');
 const appId=order?.integration_data?.application_id;
 const appMatch=appId===undefined||appId===null?null:String(appId)===String(clientId||'');
 const currencyMatch=order?.currency==='BRL';
 const amountMatch=cents(order?.total_amount)===2000;
 const feeMatch=match?cents(order?.marketplace_fee??0)===(match[1]==='split'?100:0):false;
 const safe=testId&&!!match&&sellerMatch&&currencyMatch&&amountMatch&&feeMatch&&appMatch!==false;
 const payments=Array.isArray(order?.transactions?.payments)?order.transactions.payments:[];
 return {safe,mode:match?.[1]||null,checks:{sandbox_order_id:testId,own_reference:!!match,seller_matches:sellerMatch,application_matches:appMatch,currency_matches:currencyMatch,amount_matches:amountMatch,fee_matches:feeMatch},
  status:typeof order?.status==='string'?order.status:null,
  status_detail:typeof order?.status_detail==='string'?order.status_detail:null,
  total_paid_cents:cents(order?.total_paid_amount),
  transactions:payments.slice(0,5).map(p=>({status:typeof p?.status==='string'?p.status:null,status_detail:typeof p?.status_detail==='string'?p.status_detail:null}))};
}
