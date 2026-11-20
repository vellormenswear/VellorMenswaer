// Funções puras para auditoria de valores; inteiros em centavos e sem markup mínimo.
export function supplierCommission(retailCents,supplierCents){
 if(!Number.isInteger(retailCents)||retailCents<1||!Number.isInteger(supplierCents)||supplierCents<0)throw new Error('Valores inválidos');
 return retailCents-supplierCents;
}
export function reserveSummary({approvedFees=0,expenses=0,losses=0,recoveries=0}){
 for(const n of [approvedFees,expenses,losses,recoveries])if(!Number.isInteger(n)||n<0)throw new Error('Valor inválido');
 const beforeLosses=approvedFees-expenses;
 const contribution=Math.round(Math.max(0,beforeLosses)*0.2);
 const lossesNet=Math.max(0,losses-recoveries);
 const balance=Math.max(0,contribution-lossesNet);
 const operatingProfit=beforeLosses-lossesNet;
 return {commission_cents:approvedFees,operating_profit_cents:operatingProfit,reserve_contribution_cents:contribution,reserve_balance_cents:balance,available_cents:operatingProfit-balance,reserve_deficit_cents:Math.max(0,lossesNet-contribution)};
}
export function distributeDiscount(groups,totalDiscount){
 if(!Array.isArray(groups)||!groups.length||!Number.isInteger(totalDiscount)||totalDiscount<0)throw new Error('Desconto inválido');
 const subtotal=groups.reduce((n,g)=>n+g.subtotal,0);if(subtotal<totalDiscount||subtotal<1)throw new Error('Desconto maior que subtotal');
 let rest=totalDiscount;return groups.map((g,i)=>{const discount=i===groups.length-1?rest:Math.floor(totalDiscount*g.subtotal/subtotal);rest-=discount;return {...g,discount,total:g.subtotal-discount}});
}
