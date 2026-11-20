import {sql,transaction} from '@/lib/db';import {requireUser} from '@/lib/auth';
import {ok,fail,body,originGuard,ensure,HttpError,uuid,txt} from '@/lib/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req,{params}){try{const u=await requireUser(req);const {resource}=await params;
 if(resource==='addresses'){const r=await sql('SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC,created_at DESC',[u.id]);return ok({addresses:r.rows})}
 if(resource==='orders'){const r=await sql(`SELECT o.id,o.order_number,o.status,o.payment_status,o.total_cents,o.created_at,o.tracking_code,o.shipping_carrier,(SELECT COUNT(*)::int FROM supplier_order_groups g WHERE g.order_id=o.id) AS supplier_groups FROM orders o WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 100`,[u.id]);return ok({orders:r.rows})}
 if(resource==='order'){const id=new URL(req.url).searchParams.get('id');ensure(uuid(id),'Pedido inválido.');const r=await sql('SELECT * FROM orders WHERE id=$1 AND customer_id=$2',[id,u.id]);ensure(r.rowCount,'Pedido não encontrado.',404);const [items,history,payments,requests]=await Promise.all([sql('SELECT sku_snapshot,product_name_snapshot,variant_snapshot,size_snapshot,quantity,unit_price_cents,line_total_cents FROM order_items WHERE order_id=$1',[id]),sql('SELECT from_status,to_status,note,created_at FROM order_status_history WHERE order_id=$1 ORDER BY created_at DESC',[id]),sql('SELECT status,payment_method,environment,created_at FROM payments WHERE order_id=$1',[id]),sql('SELECT id,type,status,reason,created_at,admin_note FROM customer_requests WHERE order_id=$1',[id])]);return ok({order:r.rows[0],items:items.rows,history:history.rows,payments:payments.rows,requests:requests.rows})}
 throw new HttpError(404,'Recurso não encontrado.');}catch(e){return fail(e)}}
export async function POST(req,{params}){try{originGuard(req);const u=await requireUser(req);const {resource}=await params;const x=await body(req);
 if(resource==='addresses'){
 const cep=String(x.cep||'').replace(/\D/g,'');ensure(cep.length===8&&txt(x.street).length>=2&&txt(x.number).length>=1&&txt(x.city).length>=2&&/^[A-Za-z]{2}$/.test(x.state||'')&&txt(x.neighborhood).length>=2&&txt(x.recipient).length>=2,'Endereço incompleto.');
 const id=uuid(x.id)?x.id:null;const data=[txt(x.label,70),txt(x.recipient,120),txt(x.phone,24),cep,txt(x.street,150),txt(x.number,30),txt(x.complement,120),txt(x.neighborhood,100),txt(x.city,100),txt(x.state,2).toUpperCase()];
 const q=id?await sql(`UPDATE addresses SET label=$1,recipient=$2,phone=$3,cep=$4,street=$5,number=$6,complement=$7,neighborhood=$8,city=$9,state=$10,updated_at=now() WHERE id=$11 AND user_id=$12 RETURNING id`,[...data,id,u.id]):await sql(`INSERT INTO addresses(label,recipient,phone,cep,street,number,complement,neighborhood,city,state,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,[...data,u.id]);
 ensure(q.rowCount,'Endereço não encontrado.',404);if(x.is_default){await sql('UPDATE addresses SET is_default=(id=$1) WHERE user_id=$2',[q.rows[0].id,u.id]);}return ok({id:q.rows[0].id});
 }
 if(resource==='address-delete'){ensure(uuid(x.id),'Endereço inválido.');const r=await sql('DELETE FROM addresses WHERE id=$1 AND user_id=$2 RETURNING id',[x.id,u.id]);ensure(r.rowCount,'Endereço não encontrado.',404);return ok({deleted:true})}
 if(resource==='request'){
 const id=x.orderId,kind=String(x.type||'');ensure(uuid(id)&&['cancel','return'].includes(kind)&&txt(x.reason,800).length>=5,'Solicitação inválida.');
 const order=await sql('SELECT id,status FROM orders WHERE id=$1 AND customer_id=$2',[id,u.id]);ensure(order.rowCount,'Pedido não encontrado.',404);
 if(kind==='cancel')ensure(!['shipped','delivered','canceled','refunded'].includes(order.rows[0].status),'Cancelamento direto indisponível; solicite devolução.',409);
 const rr=await sql('INSERT INTO customer_requests(order_id,user_id,type,reason) VALUES($1,$2,$3,$4) RETURNING id',[id,u.id,kind,txt(x.reason,800)]);await sql('INSERT INTO order_status_history(order_id,from_status,to_status,actor_id,note) VALUES($1,$2,$3,$4,$5)',[id,order.rows[0].status,order.rows[0].status,u.id,`Cliente solicitou ${kind}.`]);return ok({id:rr.rows[0].id})}
 throw new HttpError(404,'Recurso não encontrado.');}catch(e){return fail(e)}}
