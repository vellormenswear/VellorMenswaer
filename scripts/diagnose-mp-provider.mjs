// One-shot, read-only audit. Do not print URLs, tokens, emails, request payloads or customer details.
// Avoid using a checkout browser: this queries the provider APIs with the encrypted seller OAuth token.
import pg from 'pg';
import {createDecipheriv} from 'node:crypto';
import {normalizePgConnectionString} from '../lib/postgres-ssl.mjs';
const env=process.env;
if(env.MP_MODE!=='sandbox'||env.VERCEL_ENV!=='production'){
 console.info('[mp.provider.audit]',JSON.stringify({result:'SKIPPED_NON_SANDBOX'}));
 process.exit(0);
}
const safe=v=>{const s=String(v||'');return /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(s)?s:null};
const report=(name,body)=>console.info('[mp.provider.audit]',JSON.stringify({name,...body}));
const pool=new pg.Pool({connectionString:normalizePgConnectionString(env.DATABASE_URL),ssl:{rejectUnauthorized:true},max:2,connectionTimeoutMillis:7000,idleTimeoutMillis:3000});
function decrypt(value){
 const [nonce,tag,content]=String(value||'').split('.');
 if(!nonce||!tag||!content||!/^[a-f0-9]{64}$/i.test(env.MP_TOKEN_ENCRYPTION_KEY||''))throw Error('INVALID_ENCRYPTED_OAUTH_TOKEN');
 const dec=createDecipheriv('aes-256-gcm',Buffer.from(env.MP_TOKEN_ENCRYPTION_KEY,'hex'),Buffer.from(nonce,'base64url'));
 dec.setAuthTag(Buffer.from(tag,'base64url'));
 return Buffer.concat([dec.update(Buffer.from(content,'base64url')),dec.final()]).toString('utf8');
}
async function get(url,token){
 try{
  const res=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(7000)});
  const data=await res.json().catch(()=>({}));
  return {http:res.status,ok:res.ok,data:res.ok?data:null,error:res.ok?null:safe(data.error)||safe(data.code)||'HTTP_FAILURE'};
 }catch(e){return {http:null,ok:false,data:null,error:e?.name==='TimeoutError'?'TIMEOUT':'NETWORK_FAILURE'}}
}
const mp=(p,t)=>get('https://api.mercadopago.com'+p,t);
try{
 const id=String(env.MP_SANDBOX_TEST_SELLER_USER_ID||'').trim();
 if(!/^\d{5,20}$/.test(id))throw Error('SELLER_ID_MISSING');
 const acc=await pool.query('SELECT provider_user_id,token_encrypted,expires_at FROM supplier_mp_connections WHERE provider_user_id=$1 LIMIT 1',[id]);
 if(!acc.rowCount)throw Error('SELLER_OAUTH_NOT_CONNECTED');
 const seller=acc.rows[0],token=decrypt(seller.token_encrypted);
 report('seller_oauth',{token_format:token.startsWith('APP_USR-')?'APP_USR':'OTHER',token_unexpired:new Date(seller.expires_at)>new Date(Date.now()+120000)});
 const me=await get('https://api.mercadolibre.com/users/me',token);
 report('seller_identity',{http:me.http,error:me.error,id_matches:me.ok?String(me.data?.id)===id:null,site:me.ok?safe(me.data?.site_id):null,
  status:me.ok?safe(me.data?.status?.site_status):null,is_test_user:me.ok?(Array.isArray(me.data?.tags)?me.data.tags.includes('test_user'):null):null});
 const buyerId='3854288752'; // Buyer test-user ID seen in user's Checkout Pro browser console.
 const buyer=await get('https://api.mercadolibre.com/users/'+buyerId,token);
 report('buyer_identity',{http:buyer.http,error:buyer.error,
  found:buyer.ok,id_matches:buyer.ok?String(buyer.data?.id)===buyerId:null,
  site:buyer.ok?safe(buyer.data?.site_id):null,
  active:buyer.ok?buyer.data?.status?.site_status==='active':null,
  is_test_user:buyer.ok?(Array.isArray(buyer.data?.tags)?buyer.data.tags.includes('test_user'):null):null,
  buyer_and_seller_different:buyerId!==id});
 const groups=await pool.query(`SELECT g.id,g.preference_id,g.payment_status,g.amount_cents,g.marketplace_fee_cents
  FROM supplier_order_groups g JOIN supplier_mp_connections mp ON mp.supplier_id=g.supplier_id
  WHERE mp.provider_user_id=$1 AND g.preference_id IS NOT NULL AND g.created_at>=now()-interval '18 hours'
  ORDER BY g.created_at DESC LIMIT 3`,[id]);
 let isolated=[];
 try{
  const result=await pool.query(`SELECT preference_id FROM checkout_trace_events
   WHERE stage='payment.isolated_test.preference_created' AND preference_id IS NOT NULL
     AND created_at>=now()-interval '18 hours' ORDER BY created_at DESC LIMIT 2`);
  isolated=result.rows.map(x=>x.preference_id);
 }catch{report('isolated_trace',{status:'QUERY_UNAVAILABLE'})}
 const selected=[
  ...isolated.map(preference_id=>({kind:'isolated_simple_or_split',preference_id})),
  ...groups.rows.map(g=>({kind:'storefront',...g}))
 ].filter((g,i,a)=>a.findIndex(x=>x.preference_id===g.preference_id)===i).slice(0,5);
 report('scope',{isolated_count:isolated.length,storefront_count:groups.rowCount,audited_preferences:selected.length});
 for(const group of selected){
  const pref=await mp('/checkout/preferences/'+encodeURIComponent(group.preference_id),token);
  const p=pref.data;
  report('preference',{kind:group.kind,id:group.preference_id,http:pref.http,error:pref.error,
    collector_matches:pref.ok?String(p?.collector_id)===id:null,
    live_mode:pref.ok&&typeof p?.live_mode==='boolean'?p.live_mode:null,
    status:pref.ok?safe(p?.status):null,
    marketplace_fee_cents:pref.ok?Math.round(Number(p.marketplace_fee||0)*100):null,
    total_cents:pref.ok&&Array.isArray(p?.items)?Math.round(p.items.reduce((s,x)=>s+Number(x.unit_price)*Number(x.quantity),0)*100):null,
    external_reference_matches:group.kind==='storefront'&&pref.ok?String(p.external_reference)===String(group.id):null});
  const orders=await mp('/merchant_orders/search?'+new URLSearchParams({preference_id:group.preference_id,limit:'5',offset:'0'}).toString(),token);
  const items=Array.isArray(orders.data?.elements)?orders.data.elements.filter(x=>String(x.preference_id||'')===group.preference_id):[];
  report('merchant_orders',{kind:group.kind,id:group.preference_id,http:orders.http,error:orders.error,
    total:orders.ok?Number(orders.data?.total||0):null,linked_orders:items.length,
    statuses:items.slice(0,3).map(o=>({status:safe(o.status),order_status:safe(o.order_status),
      payment_count:Array.isArray(o.payments)?o.payments.length:0}))});
  let paymentCandidates=items.flatMap(o=>Array.isArray(o.payments)?o.payments.map(p=>String(p.id||'')):[]);
  if(group.kind==='storefront'){
   const search=await mp('/v1/payments/search?'+new URLSearchParams({external_reference:group.id,limit:'5'}).toString(),token);
   const payments=Array.isArray(search.data?.results)?search.data.results.filter(x=>String(x.external_reference||'')===group.id):[];
   paymentCandidates.push(...payments.map(x=>String(x.id||'')));
   report('payment_search',{id:group.preference_id,http:search.http,error:search.error,exact_reference_matches:payments.length});
  }
  paymentCandidates=[...new Set(paymentCandidates)].filter(x=>/^\d{5,30}$/.test(x)).slice(0,3);
  for(const paymentId of paymentCandidates){
   const result=await mp('/v1/payments/'+paymentId,token);
   const p=result.data;
   report('payment',{id:group.preference_id,http:result.http,error:result.error,
     status:result.ok?safe(p?.status):null,status_detail:result.ok?safe(p?.status_detail):null,
     method:result.ok?safe(p?.payment_method_id):null,
     live_mode:result.ok?p?.live_mode:null,
     collector_matches:result.ok?String(p?.collector_id)===id:null,
     amount_matches:result.ok&&group.kind==='storefront'?Math.round(Number(p?.transaction_amount||0)*100)===Number(group.amount_cents):null});
  }
 }
}catch(e){report('audit_error',{code:safe(e?.code)||safe(e?.message)||'UNKNOWN'})}
finally{await pool.end().catch(()=>{})}
