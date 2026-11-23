import {sql,db,transaction,audit} from '@/lib/db';
import {applyMarketplaceMigrations} from '@/lib/marketplace-auto-schema.mjs';
import {requireUser,requireRole} from '@/lib/auth';
import {ok,fail,body,originGuard,ensure,uuid,txt,email,HttpError} from '@/lib/http';
import {randomToken,sha256} from '@/lib/security';
import {randomUUID} from 'node:crypto';
import {parseSupplierPix,supplierPixSummary} from '@/lib/supplier-pix.mjs';
import {supplierSubmissionValid,generatedSupplierSku,resolveApprovedProductImage} from '@/lib/marketplace-rules.mjs';
import {supplierVariantValid,supplierCommission as feeOf} from '@/lib/marketplace-rules.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const adminRoles=['admin','super_admin'];
// Somente o fornecedor dono do grupo visualiza os avisos. O marcador de leitura
// é independente do painel administrativo, que usa notifications.read_at.
async function supplierNotices(supplierId){
 const relation=await sql("SELECT to_regclass('public.supplier_notification_reads') AS table_ref");
 const ready=Boolean(relation.rows[0]?.table_ref);
 const selectRead=ready?'r.read_at':'NULL::timestamptz AS read_at';
 const joinRead=ready?'LEFT JOIN supplier_notification_reads r ON r.notification_id=n.id AND r.supplier_id=g.supplier_id':'';
 const result=await sql(`SELECT n.id,n.kind,n.created_at,n.title,${selectRead},
  g.id AS group_id,g.supplier_amount_cents,g.fulfillment_status,g.payment_status,o.order_number
  FROM supplier_order_groups g
  JOIN orders o ON o.id=g.order_id
  JOIN notifications n ON n.order_id=g.order_id AND n.payload->>'group_id'=g.id::text
  ${joinRead}
  WHERE g.supplier_id=$1 AND n.kind IN ('supplier_payment_pending','supplier_paid')
  ORDER BY n.created_at DESC LIMIT 80`,[supplierId]);
 return result.rows;
}

async function currentSupplier(req){const u=await requireUser(req);ensure(u.role==='supplier','Somente fornecedores podem acessar esta operação.',403);const r=await sql('SELECT * FROM suppliers WHERE user_id=$1',[u.id]);ensure(r.rowCount&&r.rows[0].status==='active','Fornecedor não habilitado.',403);return {user:u,supplier:r.rows[0]}}
const activeSupplier=async(id)=>{const r=await sql("SELECT id FROM suppliers WHERE id=$1 AND status='active'",[id]);ensure(r.rowCount,'Fornecedor indisponível.',409)};
export async function GET(req,{params}){try{const {action}=await params;const q=new URL(req.url).searchParams;
 if(action==='invite-check'){const token=txt(q.get('token'),200);const r=await sql('SELECT email,expires_at FROM supplier_invites WHERE token_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now()',[sha256(token)]);ensure(r.rowCount,'Convite inválido, vencido ou utilizado.',404);return ok({invite:r.rows[0]})}
 if(action.startsWith('admin-')){await requireRole(req,adminRoles);
  if(action==='admin-list'){const [suppliers,invites,queue,categories,unlinked]=await Promise.all([
   sql(`SELECT s.*,u.full_name,u.email,EXISTS(SELECT 1 FROM supplier_asaas_wallets aw WHERE aw.supplier_id=s.id) AS asaas_connected,EXISTS(SELECT 1 FROM supplier_pix_accounts pix WHERE pix.supplier_id=s.id) AS pix_registered FROM suppliers s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC`),
   sql('SELECT id,email,expires_at,used_at,revoked_at,created_at FROM supplier_invites ORDER BY created_at DESC LIMIT 70'),
   sql(`SELECT sub.*,s.business_name FROM supplier_submissions sub JOIN suppliers s ON s.id=sub.supplier_id ORDER BY (sub.status='pending') DESC,sub.created_at DESC LIMIT 100`),
   sql('SELECT id,name FROM categories WHERE active ORDER BY name'),
   sql(`SELECT COUNT(*)::int AS total FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.supplier_id IS NULL`)
  ]);return ok({suppliers:suppliers.rows,invites:invites.rows,queue:queue.rows,categories:categories.rows,unlinked_variants:unlinked.rows[0].total})}
  if(action==='admin-cancellations'){
   const r=await sql(`SELECT g.id,g.supplier_id,g.order_id,g.provider_payment_id,g.payment_status,g.fulfillment_status,g.canceled_reason,s.business_name,ce.error_message FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id LEFT JOIN supplier_cancel_events ce ON ce.group_id=g.id WHERE g.fulfillment_status='cancel_requested' OR g.payment_status IN ('refund_failed','refund_pending') ORDER BY g.updated_at DESC LIMIT 100`);return ok({groups:r.rows})
  }
  if(action==='admin-shipped'){
   const r=await sql(`SELECT g.id,g.order_id,g.supplier_id,s.business_name,g.carrier,g.tracking_code,g.posted_at,g.payment_status FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id WHERE g.fulfillment_status='shipped' AND g.payment_status='approved' ORDER BY g.posted_at DESC LIMIT 100`);return ok({groups:r.rows})
  }
  if(action==='admin-overdue'){
   const r=await sql(`SELECT g.id,g.order_id,g.supplier_id,s.business_name,g.paid_at,g.preparation_days,g.fulfillment_status,g.payment_status,g.posted_at FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id WHERE g.payment_status='approved' AND g.fulfillment_status IN ('paid','preparing') ORDER BY g.paid_at ASC LIMIT 300`);return ok({groups:r.rows})
  }
  if(action==='admin-price-requests'){return ok({requests:(await sql("SELECT r.*,s.business_name,v.sku,v.label,v.price_cents,v.supplier_cost_cents FROM supplier_price_requests r JOIN suppliers s ON s.id=r.supplier_id JOIN product_variants v ON v.id=r.variant_id ORDER BY (r.status='pending') DESC,r.created_at DESC LIMIT 150")).rows})}
  if(action==='admin-legacy'){const r=await sql(`SELECT v.id AS variant_id,v.sku,v.label,v.price_cents,v.supplier_cost_cents,p.name,p.id AS product_id,p.supplier_id FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.supplier_id IS NULL OR v.supplier_cost_cents IS NULL ORDER BY p.created_at,v.created_at LIMIT 200`);return ok({variants:r.rows})}
  if(action==='admin-finance'){
   const [groups,extras,totals,allAdjustments]=await Promise.all([
    sql(`SELECT g.id,g.order_id,g.supplier_id,s.business_name,g.amount_cents,g.supplier_amount_cents,g.marketplace_fee_cents,g.mp_fee_cents,g.payment_status,g.fulfillment_status,g.created_at FROM supplier_order_groups g JOIN suppliers s ON s.id=g.supplier_id ORDER BY g.created_at DESC LIMIT 300`),
    sql('SELECT * FROM finance_adjustments ORDER BY created_at DESC LIMIT 200'),
    sql("SELECT COALESCE(SUM(amount_cents) FILTER(WHERE payment_status='approved'),0)::bigint AS revenue,COALESCE(SUM(marketplace_fee_cents) FILTER(WHERE payment_status='approved'),0)::bigint AS commissions,COUNT(*) FILTER(WHERE payment_status='approved' AND mp_fee_cents IS NULL)::int AS fees_unreconciled,COALESCE(SUM(amount_cents) FILTER(WHERE payment_status IN ('refund_pending','refund_failed')),0)::bigint AS pending_refund_risk FROM supplier_order_groups"),
    sql("SELECT COALESCE(SUM(amount_cents) FILTER(WHERE kind='expense'),0)::bigint AS expenses,COALESCE(SUM(amount_cents) FILTER(WHERE kind='loss'),0)::bigint AS losses,COALESCE(SUM(amount_cents) FILTER(WHERE kind='recovery'),0)::bigint AS recoveries FROM finance_adjustments")
   ]);return ok({groups:groups.rows,adjustments:extras.rows,totals:totals.rows[0],adjustment_totals:allAdjustments.rows[0],reserve_percent:20})
  }
  throw new HttpError(404,'Ação desconhecida.');
 }
 const {supplier}=await currentSupplier(req);
 if(action==='notifications')return ok({notifications:await supplierNotices(supplier.id)});
 if(action==='dashboard'){
  const [subs,products,orders,asaas,changes,notices,pixAccount]=await Promise.all([
   sql('SELECT * FROM supplier_submissions WHERE supplier_id=$1 ORDER BY created_at DESC LIMIT 100',[supplier.id]),
   sql(`SELECT p.id,p.name,p.slug,p.active,p.hidden,v.id AS variant_id,v.sku,v.label,v.stock,v.stock_mode,v.supplier_available,v.supplier_cost_cents,v.price_cents,v.primary_image_url,v.preparation_days,v.delivery_days_min,v.delivery_days_max FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.supplier_id=$1 ORDER BY p.created_at DESC LIMIT 200`,[supplier.id]),
   sql(`SELECT g.id,g.order_id,g.payment_status,g.fulfillment_status,g.amount_cents,g.supplier_amount_cents,g.mp_fee_cents,g.preparation_days,g.delivery_days_min,g.delivery_days_max,g.tracking_code,g.carrier,g.created_at,g.paid_at,o.order_number,CASE WHEN g.payment_status='approved' AND g.fulfillment_status<>'awaiting_payout' THEN o.recipient_snapshot ELSE NULL END AS recipient_snapshot,
   COALESCE(json_agg(json_build_object('sku',i.sku_snapshot,'size',i.size_snapshot,'qty',i.quantity,'cost_cents',i.unit_cost_cents)) FILTER(WHERE i.id IS NOT NULL),'[]') AS items FROM supplier_order_groups g JOIN orders o ON o.id=g.order_id LEFT JOIN supplier_order_items i ON i.group_id=g.id WHERE g.supplier_id=$1 GROUP BY g.id,o.id ORDER BY g.created_at DESC LIMIT 150`,[supplier.id]),
   sql('SELECT wallet_id,verified_at FROM supplier_asaas_wallets WHERE supplier_id=$1',[supplier.id]),
   sql('SELECT id,variant_id,requested_cost_cents,status,created_at FROM supplier_price_requests WHERE supplier_id=$1 ORDER BY created_at DESC LIMIT 100',[supplier.id]),
   supplierNotices(supplier.id),
   sql('SELECT pix_type,pix_key,holder_name,updated_at FROM supplier_pix_accounts WHERE supplier_id=$1',[supplier.id])]);
  return ok({supplier,submissions:subs.rows,products:products.rows,orders:orders.rows,asaas_wallet:asaas.rows[0]||null,pix_account:supplierPixSummary(pixAccount.rows[0]),price_requests:changes.rows,notifications:notices})
 }
 throw new HttpError(404,'Recurso desconhecido.');
 }catch(e){return fail(e)}}
export async function POST(req,{params}){try{originGuard(req);const {action}=await params;const x=await body(req,120000);
 if(action.startsWith('admin-')){const u=await requireRole(req,adminRoles);
  if(action==='admin-invite'){
   await applyMarketplaceMigrations(()=>db().connect());
   const token=randomToken();
   await sql("INSERT INTO supplier_invites(email,token_hash,created_by,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",['',sha256(token),u.id]);
   await audit(u.id,'supplier.invite','supplier_invite',null,null,{delivery:'manual_link'});
   const invitePath='/fornecedor/cadastro?token='+encodeURIComponent(token);return ok({invite_path:invitePath,invite_url:new URL(invitePath,new URL(req.url).origin).href,expires_days:7},201)
  }
  if(action==='admin-invite-revoke'){ensure(uuid(x.id),'Convite inválido.');await sql('UPDATE supplier_invites SET revoked_at=now() WHERE id=$1 AND used_at IS NULL',[x.id]);await audit(u.id,'supplier.invite_revoke','supplier_invite',x.id);return ok({revoked:true})}
  if(action==='admin-suspend'){ensure(uuid(x.id),'Fornecedor inválido.');const status=x.suspended?'suspended':'active';const r=await sql('UPDATE suppliers SET status=$1,updated_at=now() WHERE id=$2 RETURNING user_id',[status,x.id]);ensure(r.rowCount,'Fornecedor inexistente.',404);await sql('UPDATE users SET suspended_at=$1 WHERE id=$2',[x.suspended?new Date():null,r.rows[0].user_id]);if(x.suspended)await sql('DELETE FROM sessions WHERE user_id=$1',[r.rows[0].user_id]);await audit(u.id,'supplier.status','supplier',x.id,null,{status});return ok({status})}
  if(action==='admin-review'){
   ensure(uuid(x.id),'Anúncio inválido.');ensure(['approved','rejected'].includes(x.decision),'Decisão inválida.');
   const result=await transaction(async c=>{
    const r=await c.query('SELECT * FROM supplier_submissions WHERE id=$1 FOR UPDATE',[x.id]);ensure(r.rowCount&&r.rows[0].status==='pending','Anúncio não está pendente.',409);const sub=r.rows[0];let productId=null;
    if(x.decision==='approved'){
     await activeSupplier(sub.supplier_id);
     const prices=Array.isArray(x.prices)?x.prices:[];ensure(prices.length===sub.variants.length,'Informe o preço de venda de cada variação.');
     const sl=txt(x.slug,200).toLowerCase();ensure(/^[a-z0-9-]{4,200}$/.test(sl),'Slug inválido.');
     const p=await c.query(`INSERT INTO products(name,slug,description,category_id,shipping,active,hidden,supplier_id) VALUES($1,$2,$3,$4,'nacional',true,false,$5) RETURNING id`,[sub.name,sl,sub.description,sub.category_id,sub.supplier_id]);productId=p.rows[0].id;
     for(let i=0;i<sub.variants.length;i++){
      const v=sub.variants[i],price=Number(prices[i]);
      const imageUrl=resolveApprovedProductImage(v.image_url);
      ensure(supplierVariantValid({...v,image_url:imageUrl})&&Number.isInteger(price)&&price>=1&&price<=100000000,'Revise o preço de venda e os dados da variação.');feeOf(price,Number(v.cost_cents));
      await c.query(`INSERT INTO product_variants(product_id,sku,label,price_cents,stock,stock_mode,supplier_available,supplier_cost_cents,sizes,active,primary_image_url,preparation_days,delivery_days_min,delivery_days_max) VALUES($1,$2,$3,$4,$5,$6,true,$7,$8,true,$9,$10,$11,$12)`,[
       productId,v.sku.trim().toUpperCase(),v.label.trim(),price,v.stock_mode==='availability'?null:Number(v.stock),v.stock_mode,Number(v.cost_cents),v.sizes||[],imageUrl,Number(v.preparation_days)||2,Number(v.delivery_days_min)||5,Number(v.delivery_days_max)||15]);
     }
    }
    await c.query('UPDATE supplier_submissions SET status=$1,admin_note=$2,product_id=$3,reviewed_by=$4,reviewed_at=now(),updated_at=now() WHERE id=$5',[x.decision,txt(x.note,1000),productId,u.id,x.id]);return {productId}
   });await audit(u.id,'supplier.review','supplier_submission',x.id,null,{decision:x.decision,productId:result.productId});return ok(result)
  }
  if(action==='admin-assign-legacy'){
   ensure(uuid(x.supplier_id)&&uuid(x.variant_id),'Identificador inválido.');const cost=Number(x.cost_cents);ensure(Number.isInteger(cost)&&cost>=1,'Preço de fornecimento inválido.');await activeSupplier(x.supplier_id);
   const v=await transaction(async c=>{const r=await c.query(`SELECT v.*,p.supplier_id,p.id AS product_id FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=$1 FOR UPDATE`,[x.variant_id]);ensure(r.rowCount,'Variação inexistente.',404);const p=r.rows[0];ensure(!p.supplier_id||p.supplier_id===x.supplier_id,'Produto atribuído a outro fornecedor.',409);ensure(p.price_cents!==null,'Preço final ainda não definido.',409);
    await c.query('UPDATE products SET supplier_id=$1 WHERE id=$2',[x.supplier_id,p.product_id]);await c.query('UPDATE product_variants SET supplier_cost_cents=$1,stock_mode=$2,supplier_available=true WHERE id=$3',[cost,x.stock_mode==='availability'?'availability':'quantity',x.variant_id]);return p});
   await audit(u.id,'supplier.legacy_assign','variant',x.variant_id,null,{supplier_id:x.supplier_id,cost_cents:cost});return ok({updated:true,product_id:v.product_id})
  }
  if(action==='admin-refund-retry'){
    ensure(uuid(x.group_id),'Pedido inválido.',400);
    const item=await sql("SELECT id,payment_status FROM supplier_order_groups WHERE id=$1 AND payment_status IN ('refund_pending','refund_failed')",[x.group_id]);
    ensure(item.rowCount,'Não há reembolso pendente.',409);
    return ok({requires_admin:true,refund_pending:true,refund_confirmed:false,
     message:'Reembolso Asaas requer conciliação da cobrança e dos Splits. Nenhum valor foi devolvido automaticamente.'});
   }
   if(action==='admin-delivered'){
   ensure(uuid(x.group_id)&&txt(x.proof,500).length>=8,'Informe o comprovante de entrega.',400);
   const r=await sql(`UPDATE supplier_order_groups SET fulfillment_status='delivered',delivered_at=now(),updated_at=now() WHERE id=$1 AND fulfillment_status='shipped' AND payment_status='approved' RETURNING id`,[x.group_id]);ensure(r.rowCount,'Pedido ainda não está postado ou não pode ser encerrado.',409);
   await audit(u.id,'supplier.order_delivered','supplier_group',x.group_id,null,{proof:txt(x.proof,500)});return ok({updated:true});
  }
  if(action==='admin-price-review'){
   ensure(uuid(x.id)&&['approved','rejected'].includes(x.decision),'Dados inválidos.');
   const r=await transaction(async c=>{const z=await c.query('SELECT * FROM supplier_price_requests WHERE id=$1 FOR UPDATE',[x.id]);ensure(z.rowCount&&z.rows[0].status==='pending','Solicitação indisponível.',409);const item=z.rows[0];if(x.decision==='approved')await c.query('UPDATE product_variants SET supplier_cost_cents=$1,updated_at=now() WHERE id=$2',[item.requested_cost_cents,item.variant_id]);await c.query('UPDATE supplier_price_requests SET status=$1,note=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4',[x.decision,txt(x.note,500),u.id,x.id]);return item});
   await audit(u.id,'supplier.price_review','supplier_price_request',x.id,null,{decision:x.decision});return ok({updated:true})
  }
  if(action==='admin-finance-adjustment'){
   ensure(['expense','loss','recovery'].includes(x.kind),'Tipo inválido.');const amount=Number(x.amount_cents);ensure(Number.isInteger(amount)&&amount>0&&amount<100000000,'Valor inválido.');const note=txt(x.note,600);ensure(note.length>=5,'Informe o motivo.');const g=uuid(x.group_id)?x.group_id:null;
   const r=await sql('INSERT INTO finance_adjustments(group_id,kind,amount_cents,note,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',[g,x.kind,amount,note,u.id]);await audit(u.id,'finance.adjustment','finance_adjustment',r.rows[0].id,null,{kind:x.kind,amount_cents:amount});return ok({id:r.rows[0].id})
  }
  throw new HttpError(404,'Ação desconhecida.');
 }
 const {user,supplier}=await currentSupplier(req);
 if(action==='pix-account'){
  const pix=parseSupplierPix(x);
  ensure(pix,'Informe um tipo de chave Pix válido, a chave e o nome do titular.',400);
  await sql(`INSERT INTO supplier_pix_accounts(supplier_id,pix_type,pix_key,holder_name)
   VALUES($1,$2,$3,$4) ON CONFLICT(supplier_id)
   DO UPDATE SET pix_type=$2,pix_key=$3,holder_name=$4,updated_at=now()`,
   [supplier.id,pix.pix_type,pix.pix_key,pix.holder_name]);
  await audit(user.id,'supplier.pix_updated','supplier',supplier.id,null,{pix_type:pix.pix_type});
  return ok({updated:true,pix_account:supplierPixSummary({...pix,updated_at:new Date()})});
 }
 if(action==='notification-read'){
  ensure(uuid(x.notification_id),'Aviso inválido.',400);
  // Prova de titularidade usando o grupo de pedido e o ID do aviso (nunca user_id do cliente).
  const found=await sql(`SELECT n.id FROM notifications n
    JOIN supplier_order_groups g ON g.order_id=n.order_id AND n.payload->>'group_id'=g.id::text
    WHERE n.id=$1 AND g.supplier_id=$2 AND n.kind IN ('supplier_payment_pending','supplier_paid')`,
    [x.notification_id,supplier.id]);
  ensure(found.rowCount===1,'Aviso não pertence ao fornecedor.',403);
  await sql('INSERT INTO supplier_notification_reads(supplier_id,notification_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [supplier.id,x.notification_id]);
  return ok({read:true});
 }
 if(action==='request-price'){
  ensure(uuid(x.variant_id),'Variação inválida.');const cost=Number(x.cost_cents);ensure(Number.isInteger(cost)&&cost>0&&cost<=100000000,'Valor inválido.');
  const owns=await sql('SELECT 1 FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=$1 AND p.supplier_id=$2',[x.variant_id,supplier.id]);ensure(owns.rowCount,'Variação não pertence ao fornecedor.',403);
  const r=await sql("INSERT INTO supplier_price_requests(supplier_id,variant_id,requested_cost_cents) VALUES($1,$2,$3) RETURNING id",[supplier.id,x.variant_id,cost]);await audit(user.id,'supplier.price_request','variant',x.variant_id);return ok({id:r.rows[0].id},201)
 }
 if(action==='submit'){
  const variants=Array.isArray(x.variants)?x.variants:[];ensure(variants.length>0&&variants.length<=30,'Informe de 1 a 30 variações.');
  const name=txt(x.name,220);ensure(name.length>=4,'Nome muito curto.');
  // SKU e URL da foto são opcionais no envio. A validação de publicação continua
  // exigindo imagem, para que a vitrine não exiba produtos sem fotografia.
  for(const v of variants){
    v.sku=txt(v.sku,120).toUpperCase()||generatedSupplierSku(randomUUID());
    v.image_url=txt(v.image_url,2048);
  }
  ensure(variants.every(supplierSubmissionValid),'Revise modelo, custo e estoque de cada variação.');
  ensure(new Set(variants.map(v=>v.sku)).size===variants.length,'SKU duplicado.');ensure(variants.every(v=>v.stock_mode==='availability'||!Array.isArray(v.sizes)||v.sizes.length<=1),'Para estoque exato por tamanho, cadastre um SKU separado para cada tamanho.',400);
  for(const v of variants){v.sku=txt(v.sku,120).toUpperCase();v.label=txt(v.label,120);v.sizes=Array.isArray(v.sizes)?v.sizes.map(s=>txt(s,30)).slice(0,40):[];
    v.preparation_days=Number(v.preparation_days??supplier.preparation_days);v.delivery_days_min=Number(v.delivery_days_min??supplier.delivery_days_min);v.delivery_days_max=Number(v.delivery_days_max??supplier.delivery_days_max);
    ensure(Number.isInteger(v.preparation_days)&&v.preparation_days>=0&&v.preparation_days<=90&&Number.isInteger(v.delivery_days_min)&&v.delivery_days_min>=1&&v.delivery_days_max>=v.delivery_days_min&&v.delivery_days_max<=180,'Prazo de entrega inválido.');
  }
  const cat=uuid(x.category_id)?x.category_id:null;const r=await sql("INSERT INTO supplier_submissions(supplier_id,name,description,category_id,variants,status) VALUES($1,$2,$3,$4,$5,'pending') RETURNING id",[supplier.id,name,txt(x.description,4000),cat,JSON.stringify(variants)]);
  await audit(user.id,'supplier.product_submit','supplier_submission',r.rows[0].id);return ok({id:r.rows[0].id},201)
 }
 if(action==='inventory'){
  ensure(uuid(x.variant_id),'Variação inválida.');const mode=x.stock_mode;ensure(['quantity','availability'].includes(mode),'Modalidade inválida.');const qty=Number(x.stock);ensure(mode==='availability'||Number.isInteger(qty)&&qty>=0,'Quantidade inválida.');
  const r=await sql(`UPDATE product_variants v SET stock_mode=$1::text,stock=CASE WHEN $1::text='availability' THEN NULL ELSE $2::integer END,supplier_available=$3::boolean,updated_at=now() FROM products p WHERE v.product_id=p.id AND p.supplier_id=$4 AND v.id=$5 RETURNING v.id`,[mode,mode==='availability'?null:qty,Boolean(x.available),supplier.id,x.variant_id]);ensure(r.rowCount,'Variação não encontrada.',404);await audit(user.id,'supplier.inventory','variant',x.variant_id);return ok({updated:true})
 }
 if(action==='leadtime'){
  ensure(uuid(x.variant_id),'Variação inválida.');const prep=Number(x.preparation_days),min=Number(x.delivery_days_min),max=Number(x.delivery_days_max);ensure([prep,min,max].every(Number.isInteger)&&prep>=0&&prep<=90&&min>=1&&max>=min&&max<=180,'Prazo inválido.');
  const r=await sql(`UPDATE product_variants v SET preparation_days=$1,delivery_days_min=$2,delivery_days_max=$3 FROM products p WHERE v.product_id=p.id AND p.supplier_id=$4 AND v.id=$5 RETURNING v.id`,[prep,min,max,supplier.id,x.variant_id]);ensure(r.rowCount,'Variação inválida.',404);await audit(user.id,'supplier.leadtime','variant',x.variant_id);return ok({updated:true})
 }
 if(action==='ship'){
  ensure(uuid(x.group_id),'Pedido inválido.');const carrier=txt(x.carrier,120),tracking=txt(x.tracking,150);ensure(carrier.length>=2&&tracking.length>=4,'Transportadora e rastreamento são obrigatórios.');
  const r=await sql(`UPDATE supplier_order_groups SET fulfillment_status='shipped',carrier=$1,tracking_code=$2,posted_at=now(),updated_at=now() WHERE id=$3 AND supplier_id=$4 AND payment_status='approved' AND fulfillment_status IN ('paid','preparing') RETURNING id,order_id`,[carrier,tracking,x.group_id,supplier.id]);ensure(r.rowCount,'Pedido indisponível para postagem.',409);await audit(user.id,'supplier.order_shipped','supplier_group',x.group_id);return ok({updated:true})
 }
 if(action==='preparing'){
  ensure(uuid(x.group_id),'Pedido inválido.');const r=await sql(`UPDATE supplier_order_groups SET fulfillment_status='preparing',updated_at=now() WHERE id=$1 AND supplier_id=$2 AND payment_status='approved' AND fulfillment_status='paid' RETURNING id`,[x.group_id,supplier.id]);ensure(r.rowCount,'Pedido não pode ser preparado.',409);return ok({updated:true})
 }
 if(action==='cancel'){
  ensure(uuid(x.group_id),'Pedido inválido.');const reason=txt(x.reason,400);ensure(reason.length>=8,'Informe o motivo do cancelamento.');
  const r=await transaction(async c=>{const z=await c.query('SELECT * FROM supplier_order_groups WHERE id=$1 AND supplier_id=$2 FOR UPDATE',[x.group_id,supplier.id]);ensure(z.rowCount,'Pedido não encontrado.',404);const g=z.rows[0];
   ensure(['paid','preparing'].includes(g.fulfillment_status)&&g.payment_status==='approved','Cancelamento permitido apenas antes da postagem e após pagamento confirmado.',409);
   await c.query("UPDATE supplier_order_groups SET fulfillment_status='cancel_requested',payment_status='refund_pending',canceled_reason=$1,updated_at=now() WHERE id=$2",[reason,g.id]);
   await c.query('INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,$2,$3,$4)',[g.order_id,'supplier_cancel','Fornecedor cancelou um pedido; reembolso pendente',JSON.stringify({group_id:g.id,reason,supplier_id:supplier.id})]);return g;
  });
  await audit(user.id,'supplier.order_cancel','supplier_group',x.group_id,null,{reason});
  // O reembolso do checkout compartilhado exige tratamento administrativo do Asaas.
   // Não iniciar estorno parcial sem validar o impacto sobre todos os fornecedores.
   return ok({cancel_requested:true,refund_pending:true,requires_admin:true,group_id:r.id,
    message:'Reembolso pendente de análise administrativa no Asaas.'});
 }
 throw new HttpError(404,'Recurso não encontrado.');
 }catch(e){return fail(e)}}
