import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='qa/atendimento-inteligente-20261128'||!process.env.QA_SUPPORT_DATABASE_URL)throw Error('Dedicated support QA required');
process.env.DATABASE_URL=process.env.QA_SUPPORT_DATABASE_URL;
const {db,sql,transaction}=await import('../lib/db.js');
const {CATALOG_FROM,CATALOG_WHERE}=await import('../lib/catalog-query.mjs');
const {CAMPAIGN_JOIN,CAMPAIGN_PRICE}=await import('../lib/campaign-pricing.mjs');
const base='http://127.0.0.1:4181',cronSecret=randomBytes(32).toString('hex'),ids={a:randomUUID(),b:randomUUID()},tokens={},tag='support-qa-'+randomUUID();
let server,browser;
async function api(path,{role,method='GET',data,token,expected=200,secret}={}){
 const headers={'Content-Type':'application/json','Origin':base};
 if(role)headers.Cookie='pg_goston_sid='+tokens[role];if(token)headers.Cookie=(headers.Cookie?headers.Cookie+'; ':'')+'vellor_support_session='+token;if(secret)headers.Authorization='Bearer '+secret;
 const r=await fetch(base+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});const j=await r.json().catch(()=>({}));
 assert.equal(r.status,expected,path+' '+JSON.stringify(j).slice(0,250));return {data:j,cookie:r.headers.get('set-cookie')?.match(/vellor_support_session=([^;]+)/)?.[1]};
}
const chat=(role,data,expected=200)=>api('/api/support/chat',{role,method:'POST',data,expected}).then(x=>x.data);
const admin=(data)=>api('/api/admin/support',{role:'admin',method:'POST',data}).then(x=>x.data);
const readChat=role=>api('/api/support/chat',{role}).then(x=>x.data);
const lastBot=x=>x.messages.filter(m=>m.sender_kind==='bot').at(-1)?.body||'';
try{
 const marker=(await sql("SELECT p.id,u.id AS admin FROM products p CROSS JOIN users u WHERE p.slug='qa-vellor-homologacao-20261125' AND u.email='qa-vellor-20261125-admin@example.invalid'")).rows;
 assert.equal(marker.length,1,'QA marker absent; no writes allowed');
 ids.admin=marker[0].admin;
 const migration=await readFile(new URL('../db/026_support_retention.sql',import.meta.url),'utf8');
 await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(8033331)');
  if(!(await c.query("SELECT 1 FROM schema_migrations WHERE version='026_support_retention.sql'")).rowCount){await c.query(migration);await c.query("INSERT INTO schema_migrations(version) VALUES('026_support_retention.sql')");}
  for(const role of ['a','b'])await c.query("INSERT INTO users(id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,'customer')",[ids[role],'Cliente QA '+role,role+'-'+tag+'@example.invalid',randomUUID()]);
  for(const role of ['a','b','admin']){const token=randomBytes(32).toString('hex');tokens[role]=token;await c.query("INSERT INTO sessions(user_id,token_hash,expires_at,user_agent) VALUES($1,$2,now()+interval '20 minutes',$3)",[ids[role],createHash('sha256').update(token).digest('hex'),tag]);}
 });
 const order=randomUUID();
 const orderNo=(await sql("INSERT INTO orders(id,order_number,customer_id,recipient_snapshot,subtotal_cents,total_cents,status,payment_status,paid_at,tracking_code) VALUES($1,(SELECT COALESCE(max(order_number),0)+1 FROM orders),$2,$3,100,100,'shipped','approved',now(),'QA-TRACK-123') RETURNING order_number",[order,ids.a,JSON.stringify({recipient:'Cliente QA',street:'Rua Exemplo',number:'1',city:'Rio de Janeiro',state:'RJ',cep:'00000000'})])).rows[0].order_number;
 const catalog=(await sql("SELECT p.name,v.label,("+CAMPAIGN_PRICE+") AS price_cents "+CATALOG_FROM+" "+CAMPAIGN_JOIN+" WHERE "+CATALOG_WHERE+" AND p.id=$1 AND v.label='Teste válido'",[marker[0].id])).rows;
 assert.equal(catalog.length,1,'public catalogue fixture missing');
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','4181','-H','127.0.0.1'],{env:{...process.env,DATABASE_URL:process.env.QA_SUPPORT_DATABASE_URL,CRON_SECRET:cronSecret},stdio:['ignore','ignore','pipe']});
 server.stderr.on('data',chunk=>{const s=String(chunk);if(!/postgresql:|postgres:|DATABASE_URL|Bearer /i.test(s))console.log('[support.qa.server]',s.slice(0,350))});
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break}catch{}if(i===59)throw Error('QA server unavailable');await new Promise(r=>setTimeout(r,500));}
 let x=await chat('a',{action:'message',message:'tem produto fictício de homologação tamanho M?'});
 assert.match(lastBot(x),/Produto fictício de homologação/);assert.ok(lastBot(x).includes(new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(catalog[0].price_cents)/100)));assert.doesNotMatch(lastBot(x),/Teste sem estoque/);
 x=await chat('a',{action:'message',message:'e tamanho G?'});assert.match(lastBot(x),/Produto fictício de homologação/);
 assert.deepEqual((await readChat('b')).messages,[]);
 assert.match(lastBot(await readChat('a')),/Produto fictício de homologação/);
 assert.match(lastBot(await chat('b',{action:'message',message:'pedido #'+orderNo})),/Não localizei/);
 await new Promise(r=>setTimeout(r,3200));
 x=await chat('a',{action:'message',message:'pedido #'+orderNo});assert.match(lastBot(x),/QA-TRACK-123/);assert.match(lastBot(x),/Enviado/);
 x=await chat('a',{action:'message',message:'e o rastreio?'});assert.match(lastBot(x),/QA-TRACK-123/);
 console.log('[support.qa] PASS catalog price/size, contextual follow-up, cross-device account history, order privacy and tracking');
 x=await chat('a',{action:'request_human'});assert.equal(x.status,'summary');assert.match(lastBot(x),/Descreva brevemente/);
 const before=(await sql("SELECT count(*)::int AS n FROM support_threads WHERE customer_id=$1",[ids.a])).rows[0].n;assert.equal(before,0);
 x=await chat('a',{action:'message',message:'n chegou minha entega'});assert.equal(x.status,'waiting');
 const list=(await api('/api/admin/support',{role:'admin'})).data;const t=list.threads.find(t=>t.title==='Problema com a entrega'&&t.customer_name==='Cliente QA a');assert.ok(t);
 const detail=(await api('/api/admin/support?id='+t.id,{role:'admin'})).data;assert.deepEqual(detail.messages.map(m=>m.body),['n chegou minha entega']);assert.equal(detail.thread.status,'waiting');
 await api('/api/admin/support',{role:'b',expected:403});
 await admin({action:'start',thread_id:t.id});assert.equal((await readChat('a')).status,'active');
 await admin({action:'reply',thread_id:t.id,message:'Resposta QA da equipe'});
 await admin({action:'close',thread_id:t.id});
 x=await readChat('a');assert.equal(x.survey.id,t.id);assert.equal((await readChat('b')).survey,null);
 await chat('b',{action:'rating',thread_id:t.id,rating:5,message:'indevido'},409);
 console.log('[support.qa] PASS separate summary, classified thread, admin-only access, pending/active/closed transition, satisfaction ownership');
 browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(x=>x!=='--single-process'),headless:true});
 async function visual(path,viewport,role){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});await context.addCookies([{name:'pg_goston_sid',value:tokens[role],url:base,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage();const res=await page.goto(base+path,{waitUntil:'domcontentloaded'});assert.equal(res.status(),200);
  await page.getByRole('button',{name:'Abrir atendimento VELLOR'}).click();
  await page.locator('.vellor-support-panel').waitFor({state:'visible'});
  await page.locator('.vellor-support-rating-submit').waitFor({state:'visible'});
  const gradients=await page.evaluate(()=>['.vellor-support-head','.vellor-support-actions button','#vellor-support-form button','.vellor-support-rating-submit'].map(s=>{const e=document.querySelector(s);return e?getComputedStyle(e).backgroundImage:null}));
  for(const g of gradients)if(g!==null)assert.match(g,/linear-gradient/);
  const rect=await page.locator('.vellor-support-panel').boundingBox();assert.ok(rect.width<=viewport.width&&rect.x>=0);
  await page.getByRole('button',{name:'5 estrelas',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'5 estrelas',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('textbox',{name:'Comentário da avaliação'}).fill('Muito bom QA');
  assert.equal(await page.getByRole('button',{name:'Enviar avaliação',exact:true}).isEnabled(),true);
  console.log('[support.qa.visual]',JSON.stringify({path,viewport,gradients,rect:{x:rect.x,width:rect.width,height:rect.height}}));
  return {page,context};
 }
 for(const [path,viewport] of [['/',{width:1440,height:900}],['/',{width:390,height:844}],['/conta',{width:1440,height:900}],['/conta',{width:390,height:844}]]){
  const {page,context}=await visual(path,viewport,'a');
  if(path==='/conta'&&viewport.width===390){await page.getByRole('button',{name:'Enviar avaliação',exact:true}).click();await page.locator('.vellor-support-rating-submit').waitFor({state:'detached'});}
  await context.close();
 }
 const reviewed=(await api('/api/admin/support?id='+t.id,{role:'admin'})).data.thread;assert.equal(reviewed.rating,5);assert.equal(reviewed.rating_comment,'Muito bom QA');
 await chat('a',{action:'rating',thread_id:t.id,rating:4},409);
 console.log('[support.qa] PASS five SVG stars, button gradient, desktop/mobile, both storefront and account, one evaluation only');
 const expired=randomUUID(),fresh=randomUUID();
 await transaction(async c=>{
  await c.query("INSERT INTO support_ai_messages(customer_id,sender_kind,body,created_at) VALUES($1,'visitor','expired AI QA',now()-interval '25 hours'),($1,'visitor','valid AI QA',now()-interval '23 hours')",[ids.b]);
  await c.query("INSERT INTO support_threads(id,visitor_token_hash,customer_id,status,title,requested_at,created_at,closed_at) VALUES($1,$2,$3,'closed','Expired human QA',now()-interval '31 days',now()-interval '31 days',now()-interval '31 days'),($4,$5,$3,'closed','Valid human QA',now()-interval '29 days',now()-interval '29 days',now()-interval '29 days')",[expired,randomUUID(),ids.b,fresh,randomUUID()]);
  await c.query("INSERT INTO support_messages(thread_id,sender_kind,body,created_at) VALUES($1,'visitor','expired human QA',now()-interval '31 days'),($2,'visitor','valid human QA',now()-interval '29 days')",[expired,fresh]);
  await c.query("INSERT INTO notifications(kind,title,payload) VALUES('support_requested','Expired QA',$1::jsonb)",[JSON.stringify({thread_id:expired})]);
 });
 x=await readChat('b');assert.ok(x.messages.some(m=>m.body==='valid AI QA'));assert.ok(x.messages.some(m=>m.body==='valid human QA'));assert.ok(!x.messages.some(m=>/expired/i.test(m.body)));
 await api('/api/cron/support-retention',{expected:401});
 const purge=(await api('/api/cron/support-retention',{secret:cronSecret})).data;
 assert.ok(purge.ai>=1&&purge.threads>=1);
 assert.equal((await sql("SELECT count(*)::int AS n FROM support_ai_messages WHERE customer_id=$1 AND body='expired AI QA'",[ids.b])).rows[0].n,0);
 assert.equal((await sql("SELECT count(*)::int AS n FROM support_threads WHERE id=$1",[expired])).rows[0].n,0);
 assert.equal((await sql("SELECT count(*)::int AS n FROM support_messages WHERE thread_id=$1",[expired])).rows[0].n,0);
 assert.equal((await sql("SELECT count(*)::int AS n FROM notifications WHERE kind='support_requested' AND payload->>'thread_id'=$1",[expired])).rows[0].n,0);
 assert.equal((await sql("SELECT count(*)::int AS n FROM support_threads WHERE id=$1",[fresh])).rows[0].n,1);
 assert.equal((await sql("SELECT count(*)::int AS n FROM orders WHERE id=$1 AND payment_status='approved'",[order])).rows[0].n,1);
 console.log('[support.qa] PASS physical 24h/30d deletion in isolated Neon, valid history preserved, order untouched, authenticated purge endpoint');
}finally{
 await browser?.close().catch(()=>{});server?.kill('SIGTERM');await db().end();
}
