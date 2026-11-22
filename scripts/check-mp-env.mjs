// Safe build-time diagnostics: no secret/token/credential value is logged.
// Server-side flags describe the deployed Vercel environment, not the dashboard UI.
const env=process.env;
const exactFlag=k=>env[k]==='true'?'true':env[k]==='false'?'false':env[k]===undefined?'missing':'invalid';
const nonempty=k=>typeof env[k]==='string'&&env[k].trim().length>0;
const site=(env.SITE_URL||'').replace(/\/$/,'');
const parseHttps=value=>{
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash?u:null}catch{return null}
};
const siteUrl=parseHttps(site);
const redirectUrl=parseHttps(env.MP_OAUTH_REDIRECT_URI||'');
const expectedRedirect=site+'/api/marketplace/oauth-callback';
const expectedSeller=String(env.MP_SANDBOX_TEST_SELLER_USER_ID||'');
const email=String(env.MP_SANDBOX_TEST_CUSTOMER_EMAIL||'').trim();
const report={
 schema:'vellor_mp_env_preflight_v1',target:env.VERCEL_ENV||'unknown',
 present_and_required:{
  DATABASE_URL:nonempty('DATABASE_URL'),
  MP_CLIENT_ID:nonempty('MP_CLIENT_ID'),
  MP_CLIENT_SECRET:nonempty('MP_CLIENT_SECRET'),
  MP_TOKEN_ENCRYPTION_KEY:nonempty('MP_TOKEN_ENCRYPTION_KEY'),
  MP_WEBHOOK_SECRET:nonempty('MP_WEBHOOK_SECRET'),
  MP_SANDBOX_TEST_SELLER_USER_ID:nonempty('MP_SANDBOX_TEST_SELLER_USER_ID'),
  MP_SANDBOX_TEST_CUSTOMER_EMAIL:nonempty('MP_SANDBOX_TEST_CUSTOMER_EMAIL')
 },
 mode:['sandbox','production'].includes(env.MP_MODE)?env.MP_MODE:'invalid_or_missing',
 flags:{
  MP_SPLIT_ENABLED:exactFlag('MP_SPLIT_ENABLED'),
  MP_LIVE_ENABLED:exactFlag('MP_LIVE_ENABLED'),
  STORE_OPEN_FOR_ORDERS:exactFlag('STORE_OPEN_FOR_ORDERS'),
  MP_PRIMARY_1N_ENABLED:exactFlag('MP_PRIMARY_1N_ENABLED'),
  MP_PRIMARY_1N_APPROVED:exactFlag('MP_PRIMARY_1N_APPROVED')
 },
 validations:{
  SITE_URL_valid_https:!!siteUrl,
  SITE_URL_is_current_store:siteUrl?.hostname==='vellormenswear.vercel.app'&&siteUrl.pathname==='/',
  OAUTH_REDIRECT_valid_https:!!redirectUrl,
  OAUTH_REDIRECT_matches_site:!!redirectUrl&&env.MP_OAUTH_REDIRECT_URI===expectedRedirect,
  MP_CLIENT_ID_is_numeric:/^\d+$/.test(env.MP_CLIENT_ID||''),
  MP_SANDBOX_TEST_SELLER_ID_is_numeric:/^\d+$/.test(expectedSeller),
  MP_SANDBOX_TEST_CUSTOMER_EMAIL_syntax:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  MP_TOKEN_ENCRYPTION_KEY_32_byte_hex:/^[a-f0-9]{64}$/i.test(env.MP_TOKEN_ENCRYPTION_KEY||''),
  MP_WEBHOOK_SECRET_present:nonempty('MP_WEBHOOK_SECRET'),
  MP_CLIENT_SECRET_present:nonempty('MP_CLIENT_SECRET'),
  MP_TEST_ACCESS_TOKEN_present_for_primary_1n:nonempty('MP_TEST_ACCESS_TOKEN'),
  MP_PRIMARY_TEST_SELLER_USER_ID_valid:/^\d+$/.test(env.MP_PRIMARY_TEST_SELLER_USER_ID||''),
  MP_SECONDARY_TEST_RECEIVER_ID_present:nonempty('MP_SECONDARY_TEST_RECEIVER_ID')
 }
};
console.info('[vellor.mp.env-preflight]',JSON.stringify(report));
