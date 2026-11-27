import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='qa/supplier-live-sync-20261127'||!process.env.QA_PAYOUT_DATABASE_URL)throw Error('Isolated payout QA environment required');
process.env.DATABASE_URL=process.env.QA_PAYOUT_DATABASE_URL;
const {db,sql,transaction}=await import('../lib/db.js');
const {POST:record}=await import('../app/api/admin/infinitepay/route.js');
const {GET:dashboard}=await import('../app/api/suppliers/[action]/route.js');
const {GET:tracking}=await import('../app/api/account/tracking/route.js');
const {GET:label}=await import('../app/api/shipping-label/route.js');
const fake='qa-payout-'+randomUUID();
const tokens={};const path='https://qa-payout.example.invalid';
const req=(route,role,body)=>new Request(path+route,{method:body?'POST':'GET',headers:{cookie:'pg_goston_sid='+tokens[role],...(body?{'Content-Type':'application/json',origin:path}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function json(response,status=200){assert.equal(response.status,status,await response.clone().text());return response.json();}
try{
 const marker=(await sql("SELECT p.id,p.supplier_id,s.user_id AS supplier_user,u.id AS admin,pix.updated_at FROM products p JOIN suppliers s ON s.id=p.supplier_id JOIN supplier_pix_accounts pix ON pix.supplier_id=s.id CROSS JOIN users u WHERE p.slug='qa-vellor-homologacao-20261125' AND u.email='qa-vellor-20261125-admin@example.invalid'")).rows;
 assert.equal(marker.length,1,'QA marker absent: no writes allowed');const qa=marker[0];
 // Only after the isolated preview guard and marker. Test the exact additive migration.
 await sql(await (await import('node:fs/promises')).readFile(new URL('../db/023_address_recipient.sql',import.meta.url),'utf8'));
 const {POST:saveAddress,GET:readAddresses}=await import('../app/api/account/[resource]/route.js');
 const qaSupplier=randomUUID(),qaOtherSupplier=randomUUID();
 const ids={admin:qa.admin,supplier:randomUUID(),other:randomUUID(),customer:randomUUID(),otherCustomer:randomUUID()};
 const order=randomUUID(),group=randomUUID(),item=randomUUID(),img='/product-images/sem-foto.svg',reference='QA-'+randomUUID();
 const recipient={recipient:'Destinatário fictício QA',street:'Rua Exemplo',number:'100',complement:'Apto 2',neighborhood:'Centro',city:'Rio de Janeiro',state:'RJ',cep:'00000000'};
 await transaction(async c=>{
  for(const [role,id,supplierId] of [['supplier',ids.supplier,qaSupplier],['other',ids.other,qaOtherSupplier]]){
   await c.query("INSERT INTO users(id,full_name,email,password_hash,role) VALUES($1,'Fornecedor fictício QA',$2,$3,'supplier')",[id,role+'-'+fake+'@example.invalid',randomUUID()]);
   await c.query("INSERT INTO suppliers(id,user_id,business_name,document_number,status) VALUES($1,$2,'Fornecedor fictício QA',$3,'active')",[supplierId,id,'QA-'+randomUUID()]);
  }
  const pix=(await c.query("INSERT INTO supplier_pix_accounts(supplier_id,pix_type,pix_key,holder_name) VALUES($1,'random',$2,'Fornecedor fictício QA') RETURNING updated_at",[qaSupplier,randomUUID()])).rows[0];qa.updated_at=pix.updated_at;
  for(const role of ['customer','otherCustomer'])await c.query("INSERT INTO users(id,full_name,email,password_hash,role) VALUES($1,'Cliente fictício QA',$2,$3,'customer')",[ids[role],role+'-'+fake+'@example.invalid',randomUUID()]);
  for(const [role,id] of Object.entries(ids)){const token=randomBytes(32).toString('hex');tokens[role]=token;await c.query("INSERT INTO sessions(user_id,token_hash,expires_at,user_agent) VALUES($1,$2,now()+interval '10 minutes',$3)",[id,createHash('sha256').update(token).digest('hex'),fake]);}
  await c.query("INSERT INTO orders(id,order_number,customer_id,recipient_snapshot,subtotal_cents,total_cents,status,payment_status,paid_at) VALUES($1,(SELECT COALESCE(max(order_number),0)+1 FROM orders),$2,$3,250,250,'paid','approved',now())",[order,ids.customer,JSON.stringify(recipient)]);
  await c.query("INSERT INTO payments(order_id,amount_cents,provider,status,environment,payment_method) VALUES($1,250,'infinitepay','approved','sandbox','pix')",[order]);
  await c.query("INSERT INTO supplier_order_groups(id,order_id,supplier_id,amount_cents,supplier_amount_cents,marketplace_fee_cents,payment_status,fulfillment_status,paid_at) VALUES($1,$2,$3,250,200,50,'approved','awaiting_payout',now())",[group,order,qaSupplier]);
  await c.query("INSERT INTO order_items(id,order_id,variant_id,sku_snapshot,product_name_snapshot,variant_snapshot,size_snapshot,image_url_snapshot,quantity,unit_price_cents,line_total_cents) VALUES($1,$2,$3,'QA-SKU','Produto fictício QA','Amarelo','33',$4,1,250,250)",[item,order,null,img]);
  await c.query("INSERT INTO supplier_order_items(group_id,order_item_id,variant_id,sku_snapshot,size_snapshot,quantity,unit_cost_cents,supplier_line_cents) VALUES($1,$2,$3,'QA-SKU','33',1,200,200)",[group,item,null]);
  await c.query("INSERT INTO notifications(order_id,kind,title,payload) VALUES($1,'supplier_payment_pending','QA pagamento do cliente',$2)",[order,JSON.stringify({group_id:group,supplier_id:qaSupplier})]);
 });
 const addressFields={label:'Casa QA',recipient:'304',phone:'21900000000',cep:'01001000',street:'Praça da Sé',number:'304',complement:'Apto 2',neighborhood:'Sé',city:'São Paulo',state:'SP',deliver_to_third_party:false};
 const addressParams={params:Promise.resolve({resource:'addresses'})};
 const addr=await json(await saveAddress(req('/api/account/addresses','customer',addressFields),addressParams));
 const third=await json(await saveAddress(req('/api/account/addresses','customer',{...addressFields,label:'Terceiro QA',recipient:'Pessoa Destinatária QA',deliver_to_third_party:true}),addressParams));
 const saved=(await json(await readAddresses(req('/api/account/addresses','customer'),addressParams))).addresses;
 assert.equal(saved.find(a=>a.id===addr.id).recipient,'Cliente fictício QA');assert.equal(saved.find(a=>a.id===addr.id).complement,'Apto 2');assert.equal(saved.find(a=>a.id===third.id).recipient,'Pessoa Destinatária QA');assert.equal(saved.find(a=>a.id===third.id).deliver_to_third_party,true);
 assert.equal((await saveAddress(req('/api/account/addresses','customer',{...addressFields,deliver_to_third_party:true,recipient:'304'}),addressParams)).status,400);
 assert.equal((await json(await readAddresses(req('/api/account/addresses','otherCustomer'),addressParams))).addresses.length,0);
 console.log('[address.qa] PASS: additive schema, real account name, third-party address, valid complement and ownership');
 const supplierState=async role=>json(await dashboard(req('/api/suppliers/notifications',role),{params:Promise.resolve({action:'notifications'})}));
 const customerState=async role=>json(await tracking(req('/api/account/tracking?orderId='+order,role)));
 const labelRequest=(role,format)=>label(req('/api/shipping-label?group_id='+group+'&format='+format,role));
 const dash=async (role,revision='')=>json(await dashboard(req('/api/suppliers/dashboard'+(revision?'?revision='+encodeURIComponent(revision):''),role),{params:Promise.resolve({action:'dashboard'})}));
 const initial=await dash('supplier');assert.ok(initial.revision&&Array.isArray(initial.listings)&&Array.isArray(initial.categories)&&initial.user.role==='supplier');
 assert.deepEqual(await dash('supplier',initial.revision),{unchanged:true,revision:initial.revision});
 const before=await supplierState('supplier');const pre=before.orders.find(o=>o.id===group);assert.equal(pre.fulfillment_status,'awaiting_payout');assert.equal(pre.recipient_snapshot,null);assert.equal(pre.items[0].name,'Produto fictício QA');assert.equal(pre.items[0].variant,'Amarelo');assert.equal(pre.items[0].size,'33');assert.equal(pre.items[0].image_url,img);
 assert.equal((await customerState('customer')).shipments.find(s=>s.group_id===group).dispatch_confirmation,null);
 assert.equal((await labelRequest('supplier','thermal')).status,404);
 const body={action:'record_payout',group_id:group,transfer_reference:reference,notes:'QA: comprovante fictício; nenhuma transferência real.',pix_updated_at:new Date(qa.updated_at).toISOString()};
 assert.equal((await record(req('/api/admin/infinitepay','supplier',body))).status,403);
 const invalid=await record(req('/api/admin/infinitepay','admin',{...body,transfer_reference:'x'}));assert.equal(invalid.status,400);
 assert.equal((await supplierState('supplier')).orders.find(o=>o.id===group).fulfillment_status,'awaiting_payout');
 const result=await json(await record(req('/api/admin/infinitepay','admin',body)));assert.equal(result.recorded,true);assert.equal(result.amount_cents,200);
 const changed=await dash('supplier',initial.revision);assert.notEqual(changed.revision,initial.revision);assert.equal(changed.orders.find(x=>x.id===group).fulfillment_status,'paid');assert.equal(changed.notifications.filter(n=>n.group_id===group&&n.kind==='supplier_paid').length,1);
 assert.deepEqual(await dash('supplier',changed.revision),{unchanged:true,revision:changed.revision});
 const otherDash=await dash('other',changed.revision);assert.notEqual(otherDash.revision,changed.revision);assert.ok(!otherDash.orders.some(x=>x.id===group));
 console.log('[sync.qa] PASS: conditional snapshot, repasse invalidates revision, notices updated, supplier isolation');
 const after=await supplierState('supplier'),o=after.orders.find(x=>x.id===group);
 assert.equal(o.fulfillment_status,'paid');assert.equal(o.recipient_snapshot.recipient,recipient.recipient);assert.equal(o.recipient_snapshot.complement,'Apto 2');assert.equal(o.items[0].variant,'Amarelo');assert.equal(o.items[0].size,'33');assert.equal(o.items[0].image_url,img);
 assert.equal(after.notifications.filter(n=>n.group_id===group&&n.kind==='supplier_paid').length,1);
 const otherState=await supplierState('other');assert.ok(!otherState.orders.some(o=>o.id===group));assert.ok(!otherState.notifications.some(n=>n.group_id===group));
 const ship=(await customerState('customer')).shipments.find(s=>s.group_id===group);assert.ok(ship.dispatch_confirmation.awaiting_shipment&&ship.dispatch_confirmation.confirmed_by&&ship.dispatch_confirmation.confirmed_at);assert.equal(ship.snapshot,null);
 const otherShip=await customerState('otherCustomer');assert.equal(otherShip.shipments.length,0);
 for(const [format,w,h] of [['thermal',100,150],['a4',210,297]]){const r=await labelRequest('supplier',format);assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'application/pdf');const pdf=await PDFDocument.load(await r.arrayBuffer());assert.equal(pdf.getPageCount(),1);assert.ok(Math.abs(pdf.getPage(0).getWidth()-w*72/25.4)<0.01);assert.ok(Math.abs(pdf.getPage(0).getHeight()-h*72/25.4)<0.01);}
 assert.equal((await labelRequest('other','thermal')).status,404);
 assert.equal((await record(req('/api/admin/infinitepay','admin',body))).status,409);
 const counts=(await sql("SELECT (SELECT count(*) FROM supplier_manual_payouts WHERE group_id=$1)::int AS payout,(SELECT count(*) FROM notifications WHERE order_id=$2 AND kind='supplier_paid' AND payload->>'group_id'=$1::text)::int AS notice,(SELECT count(*) FROM audit_logs WHERE resource_id=$1::text AND action='supplier.pix_manual_recorded')::int AS audit",[group,order])).rows[0];
 assert.deepEqual(counts,{payout:1,notice:1,audit:1});
 console.log('[payout.qa] PASS: ADM real route, supplier refresh, product snapshots, destination, notices, tracking, both label PDFs, ownership, duplicate rejection; isolated fictional data only');
}finally{await db().end();}
