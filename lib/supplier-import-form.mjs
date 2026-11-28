import {combinationKey} from './variant-grid.mjs';
export function mergeImportedRows(existing,incoming,{create,limit,photos=[]}){
 if(!incoming.length)return existing;
 const blank=existing.length===1&&!existing[0].id&&!existing[0].label&&!existing[0].sizes?.length&&!existing[0].sku&&!existing[0].cost&&!existing[0].sale&&!existing[0].cost_cents&&!existing[0].image_url&&existing[0].reported_stock==null&&existing[0].supplier_available===true;
 const rows=blank?[]:[...existing];
 for(const row of incoming){
  const key=combinationKey(row.label,row.sizes?.[0]);
  const i=rows.findIndex(v=>v.sizes?.length<=1&&combinationKey(v.label,v.sizes?.[0])===key);
  if(i>=0){const old=rows[i];rows[i]={...old,image_url:old.image_url||row.image_url||photos[0]||'',reported_stock:row.reported_stock??old.reported_stock,supplier_available:row.supplier_available??old.supplier_available};}
  else rows.push({...create(),label:row.label,sizes:row.sizes,image_url:row.image_url||photos[0]||'',reported_stock:row.reported_stock,supplier_available:row.supplier_available});
 }
 if(rows.length>limit)throw Error('O anúncio excede o limite de variações deste formulário.');
 return rows;
}
export function matchedCategory(categories,name){
 if(!name)return '';const norm=v=>String(v??'').normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
 const matches=categories.filter(c=>c.active!==false&&norm(c.name)===norm(name));
 return matches.length===1?matches[0].id:'';
}
