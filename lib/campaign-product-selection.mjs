// Search results are not discount assignments. Saved nonzero discounts restore their selection.
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function campaignProductMatches(products,search,selectedIds=[]){
 const q=normalize(search);
 if(!q)return [];
 const selected=new Set(selectedIds);
 return products.filter(p=>!selected.has(p.id)&&normalize([p.name,...(p.skus||[])].join(' ')).includes(q)).slice(0,40);
}
export function campaignSelectedIds(form){
 return [...new Set([...Object.keys(form.product_discounts||{}),...Object.keys(form.pix_product_discounts||{})])].filter(id=>Number(form.product_discounts?.[id])>0||Number(form.pix_product_discounts?.[id])>0);
}
