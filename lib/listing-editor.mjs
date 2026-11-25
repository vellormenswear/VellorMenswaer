export function reaisToCents(value){const s=String(value??'').trim();if(!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(s))return null;const [whole,fraction='']=s.replace(',','.').split('.');const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));return Number.isSafeInteger(n)&&n<=100000000?n:null;}
export function centsToReais(v){return v===null||v===undefined||v===''?'':(Number(v)/100).toFixed(2).replace('.',',');}
const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function filterSuppliers(suppliers,query,selected){return suppliers.filter(s=>(s.status==='active'||s.id===selected)&&normal(s.business_name).includes(normal(query)));}

export const SINGLE_VARIATION='Variação única';
export function isGenericVariation(label){return ['', 'padrão','padrao','variação única','variacao unica'].includes(String(label??'').trim().toLowerCase());}
export function listingVariantLabel(label,count){const text=String(label??'').trim();return count===1&&isGenericVariation(text)?SINGLE_VARIATION:text;}
