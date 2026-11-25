import {stockAllowsQuantity} from './stock-availability.mjs';
export function catalogPublication(product,variants){
 if(!product.active||product.hidden||product.launch_archived_at||product.shipping!=='nacional')return {publication_status:'hidden',publication_issues:[!product.active||product.launch_archived_at?'Produto inativo':product.hidden?'Produto oculto':'Origem não habilitada']};
 if(product.supplier_status!=='active'||product.supplier_archived_at)return {publication_status:'pending',publication_issues:['Fornecedor não vinculado ou inativo']};
 if(!variants.length)return {publication_status:'pending',publication_issues:['Cadastre uma variação']};
 const issues=variants.map(v=>{
  const errors=[];
  if(!v.active||!v.supplier_available)errors.push('Variação inativa ou indisponível');
  if(!Number.isSafeInteger(v.price_cents)||v.price_cents<=0)errors.push('Preço de venda inválido');
  if(!Number.isSafeInteger(v.supplier_cost_cents)||v.supplier_cost_cents<=0)errors.push('Informe custo de fornecimento positivo');
  else if(v.price_cents<=v.supplier_cost_cents)errors.push('Venda deve superar custo');
  if(!stockAllowsQuantity(v.stock_mode,v.stock,1))errors.push('Confirme estoque ou modalidade');
  if(!v.catalog_image_url)errors.push('Cadastre uma imagem');
  return {sku:v.sku,errors};
 });
 return {publication_status:issues.some(v=>!v.errors.length)?'published':'pending',publication_issues:issues.filter(v=>v.errors.length).map(v=>v.sku+': '+v.errors.join(', '))};
}
