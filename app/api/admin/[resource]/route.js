import {sql,transaction,audit} from '@/lib/db';import {requireRole,requirePermission,hasPermission} from '@/lib/auth';
import {ok,fail,body,originGuard,ensure,HttpError,txt,uuid,email} from '@/lib/http';import {passwordHash} from '@/lib/security';
export const runtime='nodejs';export const dynamic='force-dynamic';
const staffRoles=['employee','admin','super_admin'];
const allowedStatus={paid:['processing','cancel_requested'],processing:['packing','cancel_requested'],packing:['shipped','cancel_requested'],shipped:['delivered','return_requested'],delivered:['return_requested'],cancel_requested:['canceled','processing'],return_requested:['refunded','delivered'],awaiting_payment:['canceled'],payment_failed:['canceled']};
const privateUserColumns='id,full_name,email,phone,role,suspended_at,created_at';
export async function GET(req,{params}){try{const u=await requireRole(req,staffRoles);const {resource}=await params;const q=new URL(req.url).searchParams;
 if(resource==='dashboard'){
  ensure(await hasPermission(u,'orders.read'),'Sem permissão.',403);
  const [statuses,money,recent,requests]=await Promise.all([
  sql('SELECT status,COUNT(*)::int AS count FROM orders GROUP BY status'),
  sql(`SELECT COALESCE(SUM(total_cents) FILTER(WHERE payment_status='approved'),0)::int AS revenue,COALESCE(SUM(discount_cents) FILTER(WHERE payment_status='approved'),0)::int AS discounts,COUNT(*) FILTER(WHERE payment_status='pending')::int AS pending FROM orders`),
  sql('SELECT o.id,o.order_number,o.status,o.payment_status,o.total_cents,o.created_at,u.full_name FROM orders o JOIN users u ON u.id=o.customer_id ORDER BY o.created_at DESC LIMIT 12'),
  sql("SELECT COUNT(*)::int AS count FROM customer_requests WHERE status='open'")
  ]);return ok({status:statuses.rows,totals:money.rows[0],recent:recent.rows,requests:requests.rows[0]});
 }
 if(resource==='orders'){
  ensure(await hasPermission(u,'orders.read'),'Sem permissão.',403);
  const r=await sql('SELECT o.*,u.full_name AS customer_name,u.email AS customer_email FROM orders o JOIN users u ON u.id=o.customer_id ORDER BY o.created_at DESC LIMIT 200');return ok({orders:u.role==='employee'?r.rows.map(x=>({...x,customer_email:undefined})):r.rows});
 }
 if(resource==='order'){
  ensure(await hasPermission(u,'orders.read'),'Sem permissão.',403);const id=q.get('id');ensure(uuid(id),'Pedido inválido.');const r=await sql('SELECT o.*,u.full_name AS customer_name,u.email AS customer_email FROM orders o JOIN users u ON o.customer_id=u.id WHERE o.id=$1',[id]);ensure(r.rowCount,'Pedido não encontrado.',404);
  const [items,history,payments,requests]=await Promise.all([sql('SELECT * FROM order_items WHERE order_id=$1',[id]),sql('SELECT h.*,u.full_name AS actor FROM order_status_history h LEFT JOIN users u ON u.id=h.actor_id WHERE order_id=$1 ORDER BY created_at DESC',[id]),sql('SELECT id,provider,status,payment_method,amount_cents,environment,created_at FROM payments WHERE order_id=$1',[id]),sql('SELECT * FROM customer_requests WHERE order_id=$1',[id])]);return ok({order:r.rows[0],items:items.rows,history:history.rows,payments:payments.rows,requests:requests.rows});
 }
 if(resource==='products'){
  ensure(await hasPermission(u,'products.read'),'Sem permissão.',403);const [products,variants,categories,images]=await Promise.all([sql('SELECT p.*,c.name AS category FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.created_at DESC'),sql('SELECT * FROM product_variants ORDER BY created_at ASC'),sql('SELECT * FROM categories ORDER BY sort_order,name'),sql('SELECT * FROM product_images ORDER BY created_at DESC')]);return ok({products:products.rows,variants:variants.rows,categories:categories.rows,images:images.rows})
 }
 if(resource==='coupons'){await requireRole(req,['admin','super_admin']);return ok({coupons:(await sql('SELECT * FROM coupons ORDER BY created_at DESC')).rows})}
 if(resource==='customers'){await requireRole(req,['admin','super_admin']);return ok({customers:(await sql(`SELECT u.${privateUserColumns.replaceAll(',',',u.')},COUNT(o.id)::int AS orders FROM users u LEFT JOIN orders o ON o.customer_id=u.id WHERE u.role='customer' GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`)).rows})}
 if(resource==='team'){await requireRole(req,['admin','super_admin']);const team=await sql(`SELECT ${privateUserColumns},(SELECT array_agg(permission) FROM staff_permissions p WHERE p.user_id=users.id) AS permissions FROM users WHERE role IN ('employee','admin','super_admin') ORDER BY created_at DESC`);return ok({team:team.rows})}
 if(resource==='audit'){await requireRole(req,['super_admin']);return ok({audit:(await sql('SELECT a.*,u.email AS actor_email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY created_at DESC LIMIT 250')).rows})}
 if(resource==='notifications'){ensure(await hasPermission(u,'orders.read'),'Sem permissão.',403);return ok({notifications:(await sql('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100')).rows})}
 if(resource==='settings'){await requireRole(req,['admin','super_admin']);const rows=await sql('SELECT key,value FROM store_settings WHERE sensitive=false ORDER BY key');return ok({settings:rows.rows,integrations:u.role==='super_admin'?{neon:!!process.env.DATABASE_URL,asaas_sandbox:process.env.ASAAS_BASE_URL==='https://api-sandbox.asaas.com/v3'&&!!process.env.ASAAS_API_KEY,webhook_secret:!!process.env.ASAAS_WEBHOOK_TOKEN,blob:!!process.env.BLOB_READ_WRITE_TOKEN,resend:!!process.env.RESEND_API_KEY}:undefined})}
 if(resource==='requests'){ensure(await hasPermission(u,'orders.read'),'Sem permissão.',403);return ok({requests:(await sql('SELECT r.*,o.order_number,u.full_name AS customer_name FROM customer_requests r JOIN orders o ON o.id=r.order_id JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC LIMIT 200')).rows})}
 if(resource==='reports'){await requireRole(req,['admin','super_admin']);const r=await sql(`SELECT date_trunc('day',created_at)::date AS day,COUNT(*)::int AS orders,COALESCE(SUM(total_cents),0)::int AS total_cents,COALESCE(SUM(discount_cents),0)::int AS discounts_cents FROM orders WHERE payment_status='approved' AND created_at>now()-interval'90 days' GROUP BY day ORDER BY day DESC`);return ok({report:r.rows})}
 throw new HttpError(404,'Recurso não encontrado.');
 }catch(e){return fail(e)}}
export async function POST(req,{params}){try{originGuard(req);const u=await requireRole(req,staffRoles);const {resource}=await params;const x=await body(req,100000);
 if(resource==='order-status'){
  ensure(await hasPermission(u,'orders.process'),'Sem permissão operacional.',403);const id=x.id,to=txt(x.status,30);ensure(uuid(id),'Pedido inválido.');
  const row=await transaction(async c=>{const rr=await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id]);ensure(rr.rowCount,'Pedido não encontrado.',404);const p=rr.rows[0];ensure((allowedStatus[p.status]||[]).includes(to),'Transição de status não permitida.',409);
  if(['processing','packing','shipped','delivered'].includes(to))ensure(p.payment_status==='approved','Pedido não possui pagamento confirmado.',409);
  if(to==='shipped')ensure(txt(x.tracking,120).length>3,'Código de rastreio obrigatório.',400);
  if(to==='refunded')throw new HttpError(403,'Reembolso deve ser confirmado pelo provedor, não por alteração manual.');
  await c.query('UPDATE orders SET status=$1,tracking_code=COALESCE($2,tracking_code),shipping_carrier=COALESCE($3,shipping_carrier),operational_note=COALESCE($4,operational_note),updated_at=now() WHERE id=$5',[to,to==='shipped'?txt(x.tracking,120):null,to==='shipped'?txt(x.carrier,100):null,txt(x.note,1500)||null,id]);
  await c.query('INSERT INTO order_status_history(order_id,from_status,to_status,actor_id,note) VALUES($1,$2,$3,$4,$5)',[id,p.status,to,u.id,txt(x.note,1500)]);return p});
  await audit(u.id,'order.status', 'order',id,{status:row.status},{status:to,tracking:txt(x.tracking,120)||undefined});return ok({updated:true});
 }
 if(resource==='order-note'){ensure(await hasPermission(u,'orders.process'),'Sem permissão.',403);ensure(uuid(x.id),'Pedido inválido.');const note=txt(x.note,2000);ensure(note,'Observação vazia.');const r=await sql('UPDATE orders SET operational_note=$1 WHERE id=$2 RETURNING id',[note,x.id]);ensure(r.rowCount,'Pedido não encontrado.',404);await audit(u.id,'order.note','order',x.id,null,{note});return ok({updated:true})}
 if(resource==='notifications-read'){ensure(await hasPermission(u,'orders.read'),'Sem permissão.',403);ensure(uuid(x.id),'Notificação inválida.');await sql('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1',[x.id]);return ok({updated:true})}
 if(resource==='category'){
  await requireRole(req,['admin','super_admin']);const name=txt(x.name,100),slug=txt(x.slug,120).toLowerCase();ensure(name.length>=2&&/^[a-z0-9-]+$/.test(slug),'Categoria inválida.');const rr=await sql(`INSERT INTO categories(name,slug) VALUES($1,$2) ON CONFLICT(slug) DO UPDATE SET name=excluded.name RETURNING id`,[name,slug]);await audit(u.id,'category.upsert','category',rr.rows[0].id,null,{name,slug});return ok({id:rr.rows[0].id});
 }
 if(resource==='product'){
  await requireRole(req,['admin','super_admin']);const name=txt(x.name,240),slug=txt(x.slug,200).toLowerCase();ensure(name.length>=4&&/^[a-z0-9-]+$/.test(slug),'Nome ou slug inválido.');let id=uuid(x.id)?x.id:null;
  const shipping=['nacional','internacional','a_confirmar'].includes(x.shipping)?x.shipping:'nacional';const active=Boolean(x.active),hidden=Boolean(x.hidden)||shipping!=='nacional';
  if(id){const r=await sql('UPDATE products SET name=$1,slug=$2,description=$3,category_id=$4,shipping=$5,active=$6,hidden=$7,updated_at=now() WHERE id=$8 RETURNING id',[name,slug,txt(x.description,4000),uuid(x.category_id)?x.category_id:null,shipping,active,hidden,id]);ensure(r.rowCount,'Produto não encontrado.',404)}
  else{const r=await sql('INSERT INTO products(name,slug,description,category_id,shipping,active,hidden) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[name,slug,txt(x.description,4000),uuid(x.category_id)?x.category_id:null,shipping,active,hidden]);id=r.rows[0].id}
  await audit(u.id,'product.upsert','product',id,null,{name,slug,shipping,active,hidden});return ok({id});
 }
 if(resource==='variant'){
  await requireRole(req,['admin','super_admin']);ensure(uuid(x.product_id),'Produto inválido.');const sku=txt(x.sku,120).toUpperCase(),label=txt(x.label,140);
  ensure(sku.length>=2&&label.length>=1,'SKU ou variação inválida.');const price=x.price_cents===null||x.price_cents===''?null:Number(x.price_cents),stock=x.stock===null||x.stock===''?null:Number(x.stock);
  ensure(price===null||(Number.isInteger(price)&&price>=0&&price<=100000000),'Preço inválido.');ensure(stock===null||(Number.isInteger(stock)&&stock>=0),'Estoque inválido.');
  const sizes=Array.isArray(x.sizes)?x.sizes.map(t=>txt(t,30)).filter(Boolean).slice(0,40):[];
  const img=txt(x.image_url,1000);ensure(!img||img.startsWith('/product-images/')||img.startsWith('https://'),'URL da imagem inválida.');
  let id=uuid(x.id)?x.id:null;
  if(id){const r=await sql('UPDATE product_variants SET sku=$1,label=$2,price_cents=$3,stock=$4,sizes=$5,active=$6,primary_image_url=$7,updated_at=now() WHERE id=$8 AND product_id=$9 RETURNING id',[sku,label,price,stock,sizes,Boolean(x.active),img||null,id,x.product_id]);ensure(r.rowCount,'Variação não encontrada.',404)}
  else{const r=await sql('INSERT INTO product_variants(product_id,sku,label,price_cents,stock,sizes,active,primary_image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[x.product_id,sku,label,price,stock,sizes,Boolean(x.active),img||null]);id=r.rows[0].id}
  await audit(u.id,'variant.upsert','variant',id,null,{sku,label,price,stock,sizes});return ok({id});
 }
 if(resource==='image'){
  await requireRole(req,['admin','super_admin']);ensure(uuid(x.product_id),'Produto inválido.');const img=txt(x.url,1000);ensure(img.startsWith('https://')||img.startsWith('/product-images/'),'Endereço da imagem inválido.');
  const rr=await sql('INSERT INTO product_images(product_id,variant_id,url,alt,source_filename,sort_order) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[x.product_id,uuid(x.variant_id)?x.variant_id:null,img,txt(x.alt,200),txt(x.filename,200),Number(x.sort_order)||0]);await audit(u.id,'image.add','image',rr.rows[0].id,null,{url:img});return ok({id:rr.rows[0].id});
 }
 if(resource==='image-delete'){
  await requireRole(req,['admin','super_admin']);ensure(uuid(x.id),'Imagem inválida.');const r=await sql('DELETE FROM product_images WHERE id=$1 RETURNING id,product_id,url',[x.id]);ensure(r.rowCount,'Imagem não encontrada.',404);await audit(u.id,'image.unlink','image',x.id,{url:r.rows[0].url},null);return ok({deleted:true});
 }
 if(resource==='coupon'){
  await requireRole(req,['admin','super_admin']);const code=txt(x.code,40).toUpperCase();ensure(/^[A-Z0-9_-]{3,40}$/.test(code),'Código do cupom inválido.');const kind=x.discount_type,amount=Number(x.amount),max=x.max_uses===null||x.max_uses===''?null:Number(x.max_uses);
  ensure(['percent','fixed'].includes(kind)&&Number.isInteger(amount)&&amount>0&&(kind==='percent'?amount<=10000:amount<=10000000),'Desconto inválido.');ensure(max===null||(Number.isInteger(max)&&max>=1),'Limite inválido.');
  const min=Math.max(0,Number(x.min_subtotal_cents)||0);ensure(Number.isInteger(min),'Valor mínimo inválido.');
  let id=uuid(x.id)?x.id:null;
  const vals=[code,kind,amount,min,max,x.starts_at||null,x.expires_at||null,Boolean(x.active)];
  if(id){const r=await sql('UPDATE coupons SET code=$1,discount_type=$2,amount=$3,min_subtotal_cents=$4,max_uses=$5,starts_at=$6,expires_at=$7,active=$8 WHERE id=$9 RETURNING id',[...vals,id]);ensure(r.rowCount,'Cupom não encontrado.',404)}else{const r=await sql('INSERT INTO coupons(code,discount_type,amount,min_subtotal_cents,max_uses,starts_at,expires_at,active,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[...vals,u.id]);id=r.rows[0].id}
  await audit(u.id,'coupon.upsert','coupon',id,null,{code,kind,amount,active:x.active});return ok({id});
 }
 if(resource==='staff-profile'){
  await requireRole(req,['admin','super_admin']);ensure(uuid(x.id),'Funcionário inválido.');
  const full_name=txt(x.name,120),phone=txt(x.phone,24);
  ensure(full_name.length>=3,'Nome inválido.');
  const r=await sql("UPDATE users SET full_name=$1,phone=$2,updated_at=now() WHERE id=$3 AND role='employee' RETURNING id",[full_name,phone,x.id]);
  ensure(r.rowCount,'O alvo deve ser uma conta de Funcionário.',403);
  await audit(u.id,'staff.profile','user',x.id,null,{name:full_name,phone});return ok({updated:true});
 }
 if(resource==='staff'){
  await requireRole(req,['super_admin']);const role=x.role;ensure(['employee','admin','super_admin'].includes(role),'Função inválida.');
  if(!x.id){const mail=email(x.email),name=txt(x.name,120);ensure(/^\S+@\S+\.\S+$/.test(mail)&&name.length>=3,'Dados inválidos.');const hash=await passwordHash(x.password);const r=await transaction(async c=>{const rr=await c.query('INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',[name,mail,hash,role]);if(role==='employee'){const perms=Array.isArray(x.permissions)?x.permissions.filter(p=>['orders.read','orders.process','products.read'].includes(p)):[];for(const perm of perms)await c.query('INSERT INTO staff_permissions(user_id,permission) VALUES($1,$2)',[rr.rows[0].id,perm]);}return rr});await audit(u.id,'staff.create','user',r.rows[0].id,null,{role,mail});return ok({id:r.rows[0].id})}
  ensure(uuid(x.id)&&x.id!==u.id,'Não pode modificar seu próprio acesso.',403);
  const existing=await sql('SELECT id,role FROM users WHERE id=$1',[x.id]);ensure(existing.rowCount&&['employee','admin','super_admin'].includes(existing.rows[0].role),'Usuário inválido.',404);
  // Do not permit disabling the last active super admin.
  if(existing.rows[0].role==='super_admin'&&(role!=='super_admin'||x.suspended)){const rr=await sql("SELECT count(*)::int AS n FROM users WHERE role='super_admin' AND suspended_at IS NULL");ensure(rr.rows[0].n>1,'É necessário manter ao menos um Super Administrador ativo.',409)}
  await sql('UPDATE users SET role=$1,suspended_at=$2,updated_at=now() WHERE id=$3',[role,x.suspended?new Date():null,x.id]);
  const perms=Array.isArray(x.permissions)?x.permissions.filter(p=>['orders.read','orders.process','products.read'].includes(p)):[];
  await transaction(async c=>{await c.query('DELETE FROM staff_permissions WHERE user_id=$1',[x.id]);for(const p of perms)await c.query('INSERT INTO staff_permissions(user_id,permission) VALUES($1,$2)',[x.id,p]);if(x.suspended)await c.query('DELETE FROM sessions WHERE user_id=$1',[x.id])});
  await audit(u.id,'staff.update','user',x.id,{role:existing.rows[0].role},{role,suspended:Boolean(x.suspended),permissions:perms});return ok({updated:true});
 }
 if(resource==='settings'){
  await requireRole(req,['admin','super_admin']);const key=txt(x.key,80);const allowedGeneral=['store_name','support_email','support_whatsapp'];const sensitive=['shipping_flat_cents','storefront_sales_enabled'];
  ensure(allowedGeneral.includes(key)||(u.role==='super_admin'&&sensitive.includes(key)),'Configuração restrita.',403);let value=x.value;
  if(key==='shipping_flat_cents')ensure(value===null||(Number.isInteger(value)&&value>=0),'Frete inválido.');
  if(key==='storefront_sales_enabled')ensure(value===false,'Vendas reais estão bloqueadas neste pacote. O sandbox é obrigatório.',403);
  if(allowedGeneral.includes(key)){value=txt(value,200)}
  await sql('INSERT INTO store_settings(key,value,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value=$2,updated_by=$3,updated_at=now()',[key,JSON.stringify(value),u.id]);await audit(u.id,'settings.update','setting',key,null,{value});return ok({updated:true});
 }
 if(resource==='request'){
  await requireRole(req,['admin','super_admin']);ensure(uuid(x.id)&&['open','under_review','approved','rejected','resolved'].includes(x.status),'Solicitação inválida.');await sql('UPDATE customer_requests SET status=$1,admin_note=$2,resolved_at=CASE WHEN $1 IN (\'resolved\',\'rejected\') THEN now() ELSE null END WHERE id=$3',[x.status,txt(x.note,1200),x.id]);await audit(u.id,'request.update','request',x.id,null,{status:x.status});return ok({updated:true});
 }
 throw new HttpError(404,'Recurso não encontrado.');
 }catch(e){return fail(e)}}
