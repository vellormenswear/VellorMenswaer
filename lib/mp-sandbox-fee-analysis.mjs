// Diagnostico SOMENTE INFORMATIVO para sandbox. Sem taxa exata do MP
// nao sabemos o valor liquido recebido. Nao altera nem bloqueia pagamentos.
const cents=x=>{const n=Number(x);return Number.isSafeInteger(n)&&n>=0?n:null};
export function sandboxCheckoutFeeAnalysis({amountCents,marketplaceFeeCents,supplierAmountCents}={}){
 const total=cents(amountCents),fee=cents(marketplaceFeeCents),seller=cents(supplierAmountCents);
 if(total===null||fee===null||seller===null)return {
  valid:false,code:'INVALID_AMOUNT',risk_flags:['INVALID_AMOUNT'],
  message:'Dados financeiros indisponiveis ou invalidos.'};
 const sumMatches=(fee+seller)===total;
 const flags=[];
 if(!sumMatches)flags.push('SPLIT_AMOUNT_MISMATCH');
 if(seller===0)flags.push('ZERO_SUPPLIER_PORTION');
 if(fee>=total)flags.push('MARKETPLACE_FEE_AT_OR_ABOVE_TOTAL');
 // Este limiar apenas sinaliza um teste de valor pequeno; NAO e minimo oficial.
 if(total<1000)flags.push('LOW_VALUE_SANDBOX_TEST');
 return {
  valid:sumMatches&&fee<total&&seller>0,
  amount_cents:total,marketplace_fee_cents:fee,
  supplier_before_provider_fees_cents:seller,
  marketplace_fee_percentage:total>0?Math.round(10000*fee/total)/100:null,
  provider_fee_known:false,supplier_net_after_provider_fee_cents:null,
  payment_method_fee_unknown:true,risk_flags:flags,
  code:flags.includes('SPLIT_AMOUNT_MISMATCH')?'SPLIT_AMOUNT_MISMATCH':
   flags.includes('MARKETPLACE_FEE_AT_OR_ABOVE_TOTAL')?'INVALID_FEE_SHARE':
   flags.includes('ZERO_SUPPLIER_PORTION')?'ZERO_SUPPLIER_PORTION':
   flags.includes('LOW_VALUE_SANDBOX_TEST')?'LOW_VALUE_SANDBOX_TEST':'FINANCIAL_PREFLIGHT_OK',
  message:flags.length?
   'Verifique a divisao e as tarifas aplicaveis. O aviso de valor baixo nao e uma regra ou recusa confirmada do Mercado Pago.':
   'A divisao em centavos e coerente antes das tarifas do Mercado Pago. A liquidez final do vendedor nao foi calculada.'
 };
}
