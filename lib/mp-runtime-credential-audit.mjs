// Diagnóstico puro: expõe apenas condições booleanas, nunca valores de configuração.
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
export function mpRuntimeConfigAudit(env){
 const site=String(env.SITE_URL||'').replace(/\/$/,'');
 let siteHttps=false;
 try{
  const u=new URL(site);
  siteHttps=u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash;
 }catch{}
 return {
  sandbox_mode:env.MP_MODE==='sandbox',
  real_payments_disabled:env.MP_LIVE_ENABLED==='false',
  split_enabled:env.MP_SPLIT_ENABLED==='true',
  store_open_for_test:env.STORE_OPEN_FOR_ORDERS==='true',
  site_https_valid:siteHttps,
  oauth_redirect_matches_site:env.MP_OAUTH_REDIRECT_URI===site+'/api/marketplace/oauth-callback',
  application_id_format_valid:/^\d+$/.test(String(env.MP_CLIENT_ID||'')),
  test_seller_id_format_valid:/^\d+$/.test(String(env.MP_SANDBOX_TEST_SELLER_USER_ID||'')),
  test_customer_email_format_valid:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(env.MP_SANDBOX_TEST_CUSTOMER_EMAIL||'')),
  client_secret_present:nonempty(env.MP_CLIENT_SECRET),
  webhook_secret_present:nonempty(env.MP_WEBHOOK_SECRET),
  token_encryption_key_format_valid:/^[a-f\d]{64}$/i.test(String(env.MP_TOKEN_ENCRYPTION_KEY||'')),
  database_url_present:nonempty(env.DATABASE_URL)
 };
}
export function mpRuntimePreferenceAudit(pref,{sellerId,clientId,amountCents,feeCents}={}){
 if(!pref||typeof pref!=='object')return {found:false};
 const cents=v=>v===null||v===undefined||!Number.isFinite(Number(v))?null:Math.round(Number(v)*100);
 const items=Array.isArray(pref.items)?pref.items:null;
 const itemTotal=items?.reduce((sum,item)=>sum+Number(item.quantity||0)*Number(item.unit_price||0),0);
 const returnedClientId=pref.client_id===null||pref.client_id===undefined?null:String(pref.client_id);
 const idMatch=returnedClientId===null?null:returnedClientId===String(clientId);
 return {
  found:!!pref.id,
  seller_matches:String(pref.collector_id||'')===String(sellerId),
  application_matches:idMatch,
  item_total_matches:itemTotal===undefined||!Number.isFinite(itemTotal)?null:cents(itemTotal)===amountCents,
  fee_matches:cents(pref.marketplace_fee??0)===feeCents,
  has_valid_init_point:(()=>{try{const u=new URL(pref.init_point);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}})(),
  provider_live_mode:typeof pref.live_mode==='boolean'?pref.live_mode:null
 };
}
