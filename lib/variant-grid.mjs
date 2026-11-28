import {normalizeVariantSizes,validFootwearSizes,WATCH_SIZE} from './variant-options.mjs';
export const combinationKey=(color,size)=>JSON.stringify([String(color??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR'),String(size??'').normalize('NFKC').trim().toLocaleUpperCase('pt-BR')]);
// null means not informed; zero is a valid observation, independent of availability.
export function parseReportedStock(raw){if(raw===null||raw===undefined||raw==='')return null;if(typeof raw!=='number'&&typeof raw!=='string')throw Error('Informe uma quantidade inteira de estoque.');if(typeof raw==='string'&&!/^\d+$/.test(raw.trim()))throw Error('Informe uma quantidade inteira de estoque.');const n=Number(raw);if(!Number.isSafeInteger(n)||n<0||n>2147483647)throw Error('Informe uma quantidade inteira de estoque válida.');return n;}
export function expandVariantGrid(rows,colors,sizes,{root,limit,create}){
 const uniqueColors=[...new Map(colors.map(v=>String(v??'').trim()).filter(Boolean).map(v=>[combinationKey(v,''),v])).values()];
 const uniqueSizes=root==='relogios'?[WATCH_SIZE]:[...new Map(normalizeVariantSizes(sizes).map(v=>[combinationKey('',v),v])).values()];
 if(!uniqueColors.length||!uniqueSizes.length)throw Error('Selecione pelo menos uma cor e um tamanho.');
 if(uniqueColors.some(v=>v.length>120))throw Error('Informe uma cor ou modelo válido.');
 if(root==='calcados'&&!validFootwearSizes(uniqueSizes))throw Error('Selecione uma numeração válida.');
 // Never replace a saved SKU or a filled row; only reuse an unsaved initial blank.
 const seed=rows.length===1&&!rows[0].id&&!rows[0].label&&!rows[0].sizes?.length&&!rows[0].sku?rows[0]:null;
 const existing=seed?[]:rows;
 const covered=new Set(existing.flatMap(v=>root==='relogios'?[combinationKey(v.label,WATCH_SIZE)]:normalizeVariantSizes(v.sizes).map(size=>combinationKey(v.label,size))));
 const additions=[];
 for(const color of uniqueColors)for(const size of uniqueSizes){const k=combinationKey(color,size);if(covered.has(k))continue;covered.add(k);additions.push({color,size});}
 if(existing.length+additions.length>limit)throw Error('Limite de '+limit+' variações por produto.');
 const next=[...existing];for(const [i,{color,size}] of additions.entries()){const matching=next.find(v=>combinationKey(v.label,'')===combinationKey(color,''));const defaults=matching||seed||rows[0];const firstSeed=i===0&&seed;next.push({...create(defaults,{color,size}),label:color,sizes:[size],...(firstSeed?{image_url:seed.image_url||'',supplier_available:seed.supplier_available!==false,...(typeof seed.active==='boolean'?{active:seed.active}:{})}:{}),reported_stock:firstSeed?seed.reported_stock??null:null});}
 return next;
}
