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

// O fornecedor pode deixar o SKU vazio: a API utiliza UUID aleatório para evitar
// colisões entre anúncios, inclusive quando há fornecedores diferentes.
export function generatedSupplierSku(randomId){
 const id=String(randomId||'').replace(/[^a-f0-9]/gi,'').toUpperCase();
 if(id.length!==32)throw new Error('Identificador de SKU inválido');
 return 'VL-'+id;
}
// Rascunho para análise: não exige SKU preenchido pelo fornecedor nem URL de foto.
// Na aprovação, supplierVariantValid continua exigindo uma imagem pública.
export function supplierSubmissionValid(v){
 const sku=String(v?.sku??'');
 const price=Number(v?.cost_cents),mode=v?.stock_mode||'quantity';
 const stock=v?.stock===null?null:Number(v?.stock);
 const photo=String(v?.image_url??'');
 return /^[A-Z0-9][A-Z0-9_-]{2,118}$/i.test(sku)
 && typeof v?.label==='string'&&v.label.trim().length>0
 && Number.isInteger(price)&&price>=1&&price<=100000000
 && ['quantity','availability'].includes(mode)
 && (mode==='availability'||Number.isInteger(stock)&&stock>=0)
 && (!photo||photo.startsWith('https://')||photo.startsWith('/product-images/'));
}

// O URL pode ficar em branco no cadastro; para publicação, usamos uma
// imagem padrão identificada claramente como ausente.
export const MISSING_PRODUCT_IMAGE='/product-images/sem-foto.svg';
export function resolveApprovedProductImage(raw){
 const url=String(raw??'').trim();
 if(!url)return MISSING_PRODUCT_IMAGE;
 if(url.startsWith('https://')||url.startsWith('/product-images/'))return url;
 throw new Error('URL da imagem inválida. Informe HTTPS ou deixe em branco.');
}

// Preço informado pelo administrador em reais, convertido sem perder centavos.
export function parseRetailPriceCents(raw){
 const value=String(raw??'').trim().replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(value))throw new Error('Informe um preço de venda válido para cada variação.');
 const cents=Math.round(Number(value)*100);
 if(!Number.isSafeInteger(cents)||cents<1||cents>100000000)throw new Error('O preço de venda precisa ser maior que zero.');
 return cents;
}


// Regras genericas de anuncios, independentes de intermediador financeiro.
export function supplierVariantValid(v){
 const price=Number(v.cost_cents),stock=v.stock===null?null:Number(v.stock),mode=v.stock_mode||'quantity';
 return typeof v.sku==='string'&&/^[A-Z0-9][A-Z0-9_-]{2,118}$/i.test(v.sku)&&
 typeof v.label==='string'&&v.label.trim().length>0&&Number.isInteger(price)&&price>=1&&
 ['quantity','availability'].includes(mode)&&(mode==='availability'||Number.isInteger(stock)&&stock>=0)&&
 typeof v.image_url==='string'&&(v.image_url.startsWith('https://')||v.image_url.startsWith('/product-images/'));
}
