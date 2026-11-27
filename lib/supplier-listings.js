import {variantAvailable} from '@/lib/stock-availability.mjs';
import {randomUUID} from 'node:crypto';
import {sql,transaction,auditTx} from '@/lib/db';
import {ensure,uuid,txt,HttpError} from '@/lib/http';
import {resolveProductSlug} from '@/lib/product-slug';
import {generatedSupplierSku,resolveApprovedProductImage,supplierVariantValid} from '@/lib/marketplace-rules.mjs';
import {listingKey,listingSize,listingNext,validateListing} from '@/lib/supplier-listing-rules.mjs';
import {supplierSubmissionView} from '@/lib/supplier-private-view.mjs';

const liveVariants="SELECT v.id,v.sku,v.label,v.sizes,v.supplier_cost_cents AS cost_cents,v.price_cents,v.stock,v.stock_mode,v.supplier_available,v.primary_image_url AS image_url,v.preparation_days,v.delivery_days_min,v.delivery_days_max,v.active FROM product_variants v WHERE v.product_id=$1 AND v.supplier_retired_at IS NULL ORDER BY v.created_at,v.id";
const snapshot=v=>({...v,preparation_days:v.preparation_days??2,delivery_days_min:v.delivery_days_min??5,delivery_days_max:v.delivery_days_max??15,supplier_available:v.supplier_available!==false});
const safeProduct="SELECT * FROM products WHERE id=$1 AND supplier_id=$2 AND launch_archived_at IS NULL";
const withLock=async c=>{await c.query('SELECT pg_advisory_xact_lock(8033340)');};
const statusOf=p=>p.supplier_listing_status&&p.supplier_listing_status!=='approved'?p.supplier_listing_status:(!p.active||p.hidden?'inactive':'approved');
async function categoryRoot(c,id){
 if(!uuid(id))return '';
 return (await c.query("SELECT COALESCE(root.slug,c.slug) AS root_slug FROM categories c LEFT JOIN categories root ON root.id=c.parent_id WHERE c.id=$1 AND c.active AND COALESCE(root.active,true)",[id])).rows[0]?.root_slug||'';
}
function invalid(fields){const e=new HttpError(422,'Revise os campos destacados.');e.fields=fields;throw e;}
async function normalized(c,x,sub,p){
 const checked=validateListing(x,await categoryRoot(c,x.category_id));
 if(Object.keys(checked.errors).length)invalid(checked.errors);
 const value=checked.value, errors={},existing=p?(await c.query(liveVariants,[p.id])).rows:[],byId=new Map(existing.map(v=>[v.id,v]));
 const draft=Array.isArray(sub?.variants)?sub.variants:[],byKey=new Map(draft.filter(v=>v.key).map(v=>[v.key,v]));
 const ids=new Set(),keys=new Set(),usedSkus=new Set();
 for(let i=0;i<value.variants.length;i++){
  const v=value.variants[i],f='variants.'+i+'.';
  v.key=v.key||randomUUID();
  if(keys.has(v.key))errors[f+'sku']='Identificador de variação repetido.';
  keys.add(v.key);
  const old=v.id?byId.get(v.id):null,prev=byKey.get(v.key);
  if(v.id&&(!uuid(v.id)||!old||ids.has(v.id)))errors[f+'sku']='Variação inválida ou repetida.';
  if(old){
   ids.add(v.id);
   const raw=x.variants[i];if(raw.expected_available!==undefined&&raw.expected_available!==variantAvailable(old))errors[f+'supplier_available']='A disponibilidade foi alterada. Reabra o anúncio antes de editar.';
   if(!listingSize(old)||listingKey(old.label,listingSize(old))!==listingKey(v.label,v.sizes[0]))errors[f+'sizes']='Para alterar cor ou tamanho de um SKU existente, remova esta variação e crie outra.';
   if(v.sku&&v.sku!==old.sku.toUpperCase())errors[f+'sku']='O SKU de uma variação existente não pode ser alterado.';
   v.sku=old.sku;
  }else{
   v.id=null;
   v.sku=v.sku||prev?.sku||generatedSupplierSku(randomUUID());
  }
  const upper=v.sku.toUpperCase();
  if(usedSkus.has(upper))errors[f+'sku']='SKU duplicado.';
  usedSkus.add(upper);
  const collision=(await c.query("SELECT id FROM product_variants WHERE upper(sku)=$1 AND ($2::uuid IS NULL OR id<>$2) LIMIT 1",[upper,old?.id||null])).rowCount;
  const reserved=(await c.query("SELECT 1 FROM supplier_submissions s CROSS JOIN LATERAL jsonb_array_elements(s.variants) v WHERE s.status IN ('pending','inactive') AND ($2::uuid IS NULL OR s.id<>$2) AND upper(v->>'sku')=$1 LIMIT 1",[upper,sub?.id||null])).rowCount;
  if(collision||reserved)errors[f+'sku']='Este SKU já está em uso.';
 }
 if(Object.keys(errors).length)invalid(errors);
 return value;
}
async function listingForAction(c,supplierId,x){
 ensure(uuid(x.id),'Anúncio inválido.');
 let sub,p;
 if(x.kind==='product'){
  p=(await c.query(safeProduct+' FOR UPDATE',[x.id,supplierId])).rows[0];
  ensure(p&&p.supplier_listing_status!=='deleted','Anúncio não encontrado.',404);
  sub=(await c.query("SELECT * FROM supplier_submissions WHERE product_id=$1 AND supplier_id=$2 ORDER BY updated_at DESC NULLS LAST,id DESC LIMIT 1 FOR UPDATE",[p.id,supplierId])).rows[0];
  if(!sub){
   const variants=(await c.query(liveVariants,[p.id])).rows.map(snapshot);
   sub=(await c.query("INSERT INTO supplier_submissions(supplier_id,product_id,name,description,category_id,department,variants,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[supplierId,p.id,p.name,p.description||'',p.category_id,p.department,JSON.stringify(variants),statusOf(p)])).rows[0];
   ensure(x.revision===0,'Atualize a lista antes de continuar.',409);
   return {sub,p,status:statusOf(p)};
  }
  throw new HttpError(409,'O anúncio foi atualizado. Recarregue a lista.');
 }
 sub=(await c.query("SELECT * FROM supplier_submissions WHERE id=$1 AND supplier_id=$2 FOR UPDATE",[x.id,supplierId])).rows[0];
 ensure(sub&&sub.status!=='deleted','Anúncio não encontrado.',404);
 ensure(Number.isInteger(x.revision)&&x.revision===sub.revision,'O anúncio foi alterado. Atualize a lista.',409);
 if(sub.product_id){
  p=(await c.query(safeProduct+' FOR UPDATE',[sub.product_id,supplierId])).rows[0];
  ensure(p&&p.supplier_listing_status!=='deleted','Anúncio não encontrado.',404);
 }
 return {sub,p,status:sub.status==='approved'&&p?statusOf(p):sub.status};
}
export async function supplierListings(supplierId){
 const [subs,products]=await Promise.all([
  sql("SELECT * FROM supplier_submissions WHERE supplier_id=$1 AND status<>'deleted' ORDER BY updated_at DESC NULLS LAST,id DESC",[supplierId]),
  sql("SELECT * FROM products WHERE supplier_id=$1 AND launch_archived_at IS NULL AND supplier_listing_status IS DISTINCT FROM 'deleted' ORDER BY created_at DESC",[supplierId])
 ]);
 const productMap=new Map(products.rows.map(p=>[p.id,p])),claimed=new Set(),out=[];
 const variantMap=new Map();
 if(products.rows.length){
  const batch=liveVariants.replace('SELECT v.id,','SELECT v.product_id,v.id,').replace('v.product_id=$1','v.product_id=ANY($1::uuid[])');
  const {rows}=await sql(batch,[products.rows.map(p=>p.id)]);
  for(const v of rows){if(!variantMap.has(v.product_id))variantMap.set(v.product_id,[]);variantMap.get(v.product_id).push(snapshot(v));}
 }
 for(const sub of subs.rows){
  const p=sub.product_id?productMap.get(sub.product_id):null;
  if(sub.product_id&&(!p||claimed.has(p.id)))continue;
  if(p)claimed.add(p.id);
  const status=sub.status==='approved'&&p?statusOf(p):sub.status;
  const v=sub.status==='approved'&&p?(variantMap.get(p.id)||[]):sub.variants;
  out.push({...sub,kind:'submission',status,product_code:p?.product_code||null,variants:v,published:status==='approved'&&Boolean(p?.active&&!p?.hidden)});
 }
 for(const p of products.rows){
  if(claimed.has(p.id))continue;
  const variants=variantMap.get(p.id)||[];
  out.push({id:p.id,kind:'product',product_id:p.id,revision:0,name:p.name,description:p.description,department:p.department,category_id:p.category_id,product_code:p.product_code,status:statusOf(p),variants,published:statusOf(p)==='approved'&&p.active&&!p.hidden});
 }
 return out.map(supplierSubmissionView);
}
export async function mutateSupplierListing(user,supplier,action,x){
 return transaction(async c=>{
  await withLock(c);
  const active=await c.query("SELECT id FROM suppliers WHERE id=$1 AND status='active' AND launch_archived_at IS NULL FOR SHARE",[supplier.id]);ensure(active.rowCount,'Fornecedor indisponível.',403);
  if(action==='submit'){
   ensure(uuid(x.request_id),'Identificador de envio inválido.');
   const previous=(await c.query('SELECT id,status FROM supplier_submissions WHERE supplier_id=$1 AND request_id=$2',[supplier.id,x.request_id])).rows[0];
   if(previous){ensure(previous.status!=='deleted','Este envio foi excluído.',409);return {id:previous.id,status:previous.status,replayed:true};}
   const val=await normalized(c,x,null,null);
   const r=(await c.query("INSERT INTO supplier_submissions(supplier_id,name,description,category_id,department,variants,status,request_id) VALUES($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING id,revision",[supplier.id,val.name,val.description,val.category_id,val.department,JSON.stringify(val.variants),x.request_id])).rows[0];
   await auditTx(c,user.id,'supplier.product_submit','supplier_submission',r.id);
   return {...r,status:'pending'};
  }
  const {sub,p,status}=await listingForAction(c,supplier.id,x);
  const next=listingNext(status,action);ensure(next,'Operação incompatível com o status do anúncio.',409);
  let val={name:sub.name,description:sub.description,category_id:sub.category_id,department:sub.department,variants:sub.variants};
  if(action==='edit')val=await normalized(c,x,sub,p);
  else if(action==='deactivate'&&p&&sub.status==='approved')val={name:p.name,description:p.description,category_id:p.category_id,department:p.department,variants:(await c.query(liveVariants,[p.id])).rows.map(snapshot)};
  else if(action==='reactivate')val=await normalized(c,val,sub,p);
  const result=(await c.query("UPDATE supplier_submissions SET name=$1,description=$2,category_id=$3,department=$4,variants=$5,status=$6,revision=revision+1,admin_note=NULL,reviewed_by=NULL,reviewed_at=NULL,deleted_at=CASE WHEN $6='deleted' THEN now() ELSE deleted_at END,updated_at=now() WHERE id=$7 RETURNING id,revision,status",[val.name,val.description,val.category_id,val.department,JSON.stringify(val.variants),next,sub.id])).rows[0];
  if(p){
   await c.query('UPDATE products SET active=false,hidden=true,supplier_listing_status=$1,supplier_listing_changed_at=now(),updated_at=now() WHERE id=$2',[next,p.id]);
   await c.query("UPDATE supplier_price_requests SET status='rejected',note='Substituído por nova revisão de anúncio.',reviewed_at=now() WHERE status='pending' AND variant_id IN (SELECT id FROM product_variants WHERE product_id=$1)",[p.id]);
  }
  await auditTx(c,user.id,'supplier.listing_'+action,'supplier_submission',sub.id,{status,revision:sub.revision},{status:next,revision:result.revision});
  return result;
 });
}
export async function reviewSupplierListing(user,x){
 ensure(uuid(x.id)&&['approved','rejected'].includes(x.decision),'Decisão inválida.');
 return transaction(async c=>{
  await withLock(c);
  const sub=(await c.query('SELECT * FROM supplier_submissions WHERE id=$1 FOR UPDATE',[x.id])).rows[0];
  ensure(sub&&sub.status==='pending'&&Number.isInteger(x.revision)&&sub.revision===x.revision,'O anúncio não está pendente nesta revisão. Atualize a página.',409);
  let p=sub.product_id?(await c.query(safeProduct+' FOR UPDATE',[sub.product_id,sub.supplier_id])).rows[0]:null;
  ensure(!sub.product_id||p&&p.supplier_listing_status!=='deleted','Produto não encontrado.',409);
  let productId=p?.id||null,productCode=p?.product_code||null;
  if(x.decision==='approved'){
   const supplier=(await c.query("SELECT s.id FROM suppliers s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.status='active' AND s.launch_archived_at IS NULL AND u.launch_archived_at IS NULL AND u.suspended_at IS NULL FOR SHARE OF s,u",[sub.supplier_id])).rows[0];ensure(supplier,'Fornecedor indisponível.',409);
   const val=await normalized(c,sub,sub,p);
   const prices=x.prices&&typeof x.prices==='object'&&!Array.isArray(x.prices)?x.prices:{};
   ensure(Object.keys(prices).length===val.variants.length,'Informe o preço de cada variação desta revisão.');
   for(const v of val.variants){
    // Os anúncios legados pendentes sem chave usam o SKU como identificador.
    const price=Object.hasOwn(prices,v.sku)?prices[v.sku]:null;const imageUrl=resolveApprovedProductImage(v.image_url);
    ensure(supplierVariantValid({...v,image_url:imageUrl})&&Number.isInteger(price)&&price>v.cost_cents&&price<=100000000,'Informe preço de venda superior ao custo em cada variação.');
   }
   if(!p){
    const slug=await resolveProductSlug(c,{name:val.name,requested:txt(x.slug,200)});
    p=(await c.query("INSERT INTO products(name,slug,description,category_id,shipping,active,hidden,supplier_id,department,supplier_listing_status) VALUES($1,$2,$3,$4,'nacional',true,false,$5,$6,'approved') RETURNING id,product_code",[val.name,slug,val.description,val.category_id,sub.supplier_id,val.department])).rows[0];
    productId=p.id;productCode=p.product_code;
   }else await c.query("UPDATE products SET name=$1,description=$2,category_id=$3,department=$4,active=true,hidden=false,supplier_listing_status='approved',updated_at=now() WHERE id=$5",[val.name,val.description,val.category_id,val.department,p.id]);
   const keep=[];
   for(const v of val.variants){
    const imageUrl=resolveApprovedProductImage(v.image_url),price=prices[v.sku];
    const args=[v.sku,v.label,price,v.stock,v.stock_mode,v.supplier_available,v.cost_cents,v.sizes,imageUrl,v.preparation_days,v.delivery_days_min,v.delivery_days_max,p.id];
    let row;
    if(v.id)row=(await c.query('UPDATE product_variants SET sku=$1,label=$2,price_cents=$3,stock=$4,stock_mode=$5,supplier_available=$6,supplier_cost_cents=$7,sizes=$8,primary_image_url=$9,preparation_days=$10,delivery_days_min=$11,delivery_days_max=$12,active=true,updated_at=now() WHERE product_id=$13 AND id=$14 AND supplier_retired_at IS NULL RETURNING id',[...args,v.id])).rows[0];
    else row=(await c.query('INSERT INTO product_variants(sku,label,price_cents,stock,stock_mode,supplier_available,supplier_cost_cents,sizes,primary_image_url,preparation_days,delivery_days_min,delivery_days_max,product_id,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true) RETURNING id',args)).rows[0];
    ensure(row,'Variação não encontrada.',409);v.id=row.id;keep.push(row.id);
   }
   await c.query('UPDATE product_variants SET active=false,supplier_available=false,supplier_retired_at=now(),updated_at=now() WHERE product_id=$1 AND supplier_retired_at IS NULL AND NOT (id=ANY($2::uuid[]))',[p.id,keep]);
   await c.query('UPDATE supplier_submissions SET variants=$1 WHERE id=$2',[JSON.stringify(val.variants),sub.id]);
  }else if(p)await c.query("UPDATE products SET active=false,hidden=true,supplier_listing_status='rejected',updated_at=now() WHERE id=$1",[p.id]);
  await c.query('UPDATE supplier_submissions SET status=$1,admin_note=$2,product_id=$3,reviewed_by=$4,reviewed_at=now(),reviewed_revision=revision,updated_at=now() WHERE id=$5',[x.decision,txt(x.note,1000),productId,user.id,x.id]);
  await auditTx(c,user.id,'supplier.review','supplier_submission',sub.id,null,{decision:x.decision,productId,revision:sub.revision});
  return {productId,product_code:productCode,status:x.decision};
 });
}
