import {availabilityFields} from './stock-availability.mjs';
import {validFootwearSizes,WATCH_SIZE} from './variant-options.mjs';
export const LISTING_LIMIT=120;
export const listingKey=(color,size)=>JSON.stringify([String(color??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR'),String(size??'').normalize('NFKC').trim().toLocaleUpperCase('pt-BR')]);
export const listingSize=v=>Array.isArray(v?.sizes)&&v.sizes.length===1?String(v.sizes[0]).trim():'';
export function listingNext(status,action){
 if(status==='deleted')return null;
 if(action==='delete')return 'deleted';
 if(action==='deactivate')return 'inactive';
 if(action==='reactivate')return status==='inactive'?'pending':null;
 if(action==='edit')return status==='inactive'?'inactive':'pending';
 return null;
}
export function listingMoney(raw){
 const v=String(raw??'').trim();
 if(!/^\d{1,7}([,.]\d{1,2})?$/.test(v))return null;
 const n=Math.round(Number(v.replace(',','.'))*100);
 return Number.isSafeInteger(n)&&n>0&&n<=100000000?n:null;
}
export function validateListing(input,root){
 const errors={},variants=Array.isArray(input?.variants)?input.variants:[],seen=new Set(),skus=new Set();
 const name=String(input?.name??'').trim();
 if(name.length<4||name.length>220)errors.name='Informe um nome de 4 a 220 caracteres.';
 if(!['masculino','feminino'].includes(input?.department))errors.department='Selecione o departamento.';
 if(!input?.category_id||!root)errors.category_id='Selecione uma categoria ativa.';
 if(String(input?.description??'').length>4000)errors.description='Máximo de 4.000 caracteres.';
 if(!variants.length||variants.length>LISTING_LIMIT)errors.variants='Informe de 1 a '+LISTING_LIMIT+' variações.';
 const normalized=variants.slice(0,LISTING_LIMIT).map((value,i)=>{
  const v=value&&typeof value==='object'?value:{},prefix='variants.'+i+'.';
  const label=String(v.label??'').trim().replace(/\s+/g,' '),sku=String(v.sku??'').trim().toUpperCase();
  const sizes=Array.isArray(v.sizes)?v.sizes:typeof v.sizes==='string'?v.sizes.split(','):[];
  const size=root==='relogios'&&!v.id?WATCH_SIZE:sizes.length===1?String(sizes[0]??'').trim().toUpperCase():'';
  const image_url=String(v.image_url??'').trim();
  if(!label||label.length>120)errors[prefix+'label']='Informe uma cor ou modelo válido.';
  if(!size||size.length>30||/[,;\n]/.test(size)||root==='calcados'&&!validFootwearSizes([size]))errors[prefix+'sizes']='Informe exatamente um tamanho ou numeração válida.';
  if(label&&size){const key=listingKey(label,root==='relogios'?WATCH_SIZE:size);if(seen.has(key))errors[prefix+'sizes']='Esta combinação de cor e tamanho já existe.';seen.add(key);}
  if(sku&&(!/^[A-Z0-9][A-Z0-9_-]{2,118}$/.test(sku)||skus.has(sku)))errors[prefix+'sku']='SKU inválido ou duplicado.';
  if(sku)skus.add(sku);
  if(!Number.isInteger(v.cost_cents)||v.cost_cents<1||v.cost_cents>100000000)errors[prefix+'cost_cents']='Informe um preço de fornecimento válido.';
  if(typeof v.supplier_available!=='boolean')errors[prefix+'supplier_available']='Selecione a disponibilidade.';
  if(image_url&&(image_url.length>2048||!(/^https:\/\//.test(image_url)||image_url.startsWith('/product-images/'))))errors[prefix+'image_url']='Informe uma imagem HTTPS válida.';
  const prep=Number(v.preparation_days),min=Number(v.delivery_days_min),max=Number(v.delivery_days_max);
  if(v.preparation_days===''||v.preparation_days==null||!Number.isInteger(prep)||prep<0||prep>90)errors[prefix+'preparation_days']='Informe de 0 a 90 dias.';
  if(v.delivery_days_min===''||v.delivery_days_min==null||!Number.isInteger(min)||min<1||min>120)errors[prefix+'delivery_days_min']='Informe de 1 a 120 dias.';
  if(v.delivery_days_max===''||v.delivery_days_max==null||!Number.isInteger(max)||max<min||max>180)errors[prefix+'delivery_days_max']='Informe um prazo máximo válido, até 180 dias.';
  return {id:v.id||null,key:String(v.key??'').slice(0,120),sku,label,sizes:[size],cost_cents:v.cost_cents,...availabilityFields({...v,stock_mode:v.stock_mode??'availability'}),image_url,preparation_days:prep,delivery_days_min:min,delivery_days_max:max};
 });
 return {errors,value:{name,description:String(input?.description??'').trim(),department:input?.department,category_id:input?.category_id,variants:normalized}};
}
