import {transaction,auditTx} from '@/lib/db';
import {ensure,txt,uuid} from '@/lib/http';
import {resolveProductSlug} from '@/lib/product-slug';
import {normalizeVariantSizes,validFootwearSizes} from '@/lib/variant-options.mjs';
export async function saveAdminProduct(u,x){const name=txt(x.name,240),requested=txt(x.slug,200);ensure(name.length>=4,'Nome do produto inválido.');let id=uuid(x.id)?x.id:null,slug,productCode,supplierId;ensure(uuid(x.category_id),'Selecione uma categoria válida.');
  const shipping=['nacional','internacional','a_confirmar'].includes(x.shipping)?x.shipping:'nacional';const active=Boolean(x.active),hidden=Boolean(x.hidden)||shipping!=='nacional';
  const img=txt(x.image_url,1000);ensure(!img||img.startsWith('/product-images/')||img.startsWith('https://'),'URL da imagem inválida.');
  id=await transaction(async c=>{
   let productId=id;
   slug=await resolveProductSlug(c,{name,requested,id:productId});
   const previous=productId?(await c.query('SELECT supplier_id,category_id FROM products WHERE id=$1 AND launch_archived_at IS NULL FOR UPDATE',[productId])).rows[0]:null;
   ensure(!productId||previous,'Produto não encontrado.',404);
   const category=(await c.query('SELECT c.id,c.active,COALESCE(root.active,true) AS parent_active FROM categories c LEFT JOIN categories root ON root.id=c.parent_id WHERE c.id=$1',[x.category_id])).rows[0];ensure(category&&(previous?.category_id===category.id||(category.active&&category.parent_active)),'Categoria indisponível.');
   supplierId=x.supplier_id===undefined?previous?.supplier_id:x.supplier_id;ensure(uuid(supplierId),'Selecione um fornecedor cadastrado.');
   const supplier=(await c.query("SELECT s.id,s.status FROM suppliers s JOIN users su ON su.id=s.user_id WHERE s.id=$1 AND s.launch_archived_at IS NULL AND su.launch_archived_at IS NULL AND su.suspended_at IS NULL FOR SHARE OF s,su",[supplierId])).rows[0];ensure(supplier&&(supplier.status==='active'||previous?.supplier_id===supplierId),'Fornecedor indisponível.',409);
   if(previous?.supplier_id&&previous.supplier_id!==supplierId){const linked=await c.query('SELECT 1 FROM product_variants WHERE product_id=$1 LIMIT 1',[productId]);ensure(!linked.rowCount,'Não é possível substituir o fornecedor de um produto com variações. Cadastre um novo produto para manter estoque e pedidos consistentes.',409);}

   if(productId){const r=await c.query('UPDATE products SET name=$1,slug=$2,description=$3,category_id=$4,shipping=$5,active=$6,hidden=$7,supplier_id=$9,updated_at=now() WHERE id=$8 RETURNING id,product_code',[name,slug,txt(x.description,4000),x.category_id,shipping,active,hidden,productId,supplierId]);ensure(r.rowCount,'Produto não encontrado.',404);productCode=r.rows[0].product_code;}
   else{const r=await c.query('INSERT INTO products(name,slug,description,category_id,shipping,active,hidden,supplier_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,product_code',[name,slug,txt(x.description,4000),x.category_id,shipping,active,hidden,supplierId]);productId=r.rows[0].id;productCode=r.rows[0].product_code;}
   if(img){await c.query('UPDATE product_images SET sort_order=0 WHERE product_id=$1 AND variant_id IS NULL AND sort_order<0',[productId]);const existing=await c.query('UPDATE product_images SET sort_order=-1 WHERE product_id=$1 AND variant_id IS NULL AND url=$2 RETURNING id',[productId,img]);if(!existing.rowCount)await c.query('INSERT INTO product_images(product_id,url,alt,sort_order) VALUES($1,$2,$3,-1)',[productId,img,name]);}
   await auditTx(c,u.id,'product.upsert','product',productId,previous,{name,slug,shipping,active,hidden,supplier_id:supplierId,product_code:productCode});
   return productId;
  });
  return {id,slug,product_code:productCode};
}
export async function saveAdminVariant(u,x){return transaction(async c=>{const editable=await c.query('SELECT COALESCE(root.slug,c.slug) AS root_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN categories root ON root.id=c.parent_id WHERE p.id=$1 AND p.launch_archived_at IS NULL FOR UPDATE OF p',[uuid(x.product_id)?x.product_id:null]);ensure(editable.rowCount,'Produto indisponível.',404);
  ensure(uuid(x.product_id),'Produto inválido.');const sku=txt(x.sku,120).toUpperCase(),label=txt(x.label,140);
  ensure(sku.length>=2&&label.length>=1,'SKU ou variação inválida.');const price=x.price_cents===null||x.price_cents===''?null:Number(x.price_cents),stock=x.stock===null||x.stock===''||x.stock===undefined?null:Number(x.stock);
  const stockMode=x.stock_mode===undefined?null:x.stock_mode;ensure(stockMode===null||['quantity','availability'].includes(stockMode),'Modalidade de estoque inválida.');
  ensure(price===null||(Number.isInteger(price)&&price>=0&&price<=100000000),'Preço inválido.');ensure(stock===null||(Number.isInteger(stock)&&stock>=0),'Estoque inválido.');
  const cost=x.supplier_cost_cents===undefined?undefined:x.supplier_cost_cents===null||x.supplier_cost_cents===''?null:Number(x.supplier_cost_cents);ensure(cost===undefined||cost===null||Number.isInteger(cost)&&cost>0&&cost<=100000000,'Custo de fornecimento inválido.');ensure(price===null||cost===undefined||cost===null||price>cost,'O preço de venda deve superar o custo de fornecimento.');
  const sizes=normalizeVariantSizes(x.sizes);ensure(editable.rows[0].root_slug!=='calcados'||validFootwearSizes(sizes),'Marque a numeração válida do calçado.');
  let img=txt(x.image_url,1000);ensure(!img||img.startsWith('/product-images/')||img.startsWith('https://'),'URL da imagem inválida.');
  if(!img){const cover=await c.query('SELECT url FROM product_images WHERE product_id=$1 AND variant_id IS NULL ORDER BY sort_order,created_at DESC LIMIT 1',[x.product_id]);img=cover.rows[0]?.url||'';}
  let id=uuid(x.id)?x.id:null;
  if(id){const r=await c.query('UPDATE product_variants SET sku=$1,label=$2,price_cents=$3,stock=CASE WHEN COALESCE($12::text,stock_mode)=\'availability\' THEN NULL ELSE $4::integer END,sizes=$5,active=$6,primary_image_url=$7,supplier_cost_cents=CASE WHEN $10::boolean THEN $11::integer ELSE supplier_cost_cents END,stock_mode=COALESCE($12::text,stock_mode),supplier_available=COALESCE($13::boolean,supplier_available),updated_at=now() WHERE id=$8 AND product_id=$9 RETURNING id',[sku,label,price,stock,sizes,Boolean(x.active),img||null,id,x.product_id,cost!==undefined,cost??null,stockMode,typeof x.supplier_available==='boolean'?x.supplier_available:null]);ensure(r.rowCount,'Variação não encontrada.',404)}
  else{const r=await c.query('INSERT INTO product_variants(product_id,sku,label,price_cents,stock,sizes,active,primary_image_url,supplier_cost_cents,stock_mode,supplier_available) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',[x.product_id,sku,label,price,stockMode==='availability'?null:stock,sizes,Boolean(x.active),img||null,cost??null,stockMode||'quantity',x.supplier_available!==false]);id=r.rows[0].id}
  await auditTx(c,u.id,'variant.upsert','variant',id,null,{sku,label,price,stock,sizes});return {id};});
}
