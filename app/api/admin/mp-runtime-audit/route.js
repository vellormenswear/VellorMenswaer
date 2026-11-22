import {NextResponse} from 'next/server';
import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {decryptSecret} from '@/lib/marketplace';
import {oauthSellerId} from '@/lib/mp-oauth-identity.mjs';
import {mpRuntimeConfigAudit,mpRuntimePreferenceAudit} from '@/lib/mp-runtime-credential-audit.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
const code=error=>typeof error==='string'&&/^OAUTH_IDENTITY_HTTP_\d{3}$/.test(error)?error:'PROVIDER_QUERY_FAILED';

export async function GET(req){
 try{
  await requireRole(req,['super_admin']);
  if(process.env.MP_MODE!=='sandbox')return reply({error:'Auditoria disponível somente em sandbox.'},403);
  const configuration=mpRuntimeConfigAudit(process.env);
  const sellerId=String(process.env.MP_SANDBOX_TEST_SELLER_USER_ID||'').trim();
  if(!configuration.test_seller_id_format_valid)
   return reply({configuration,seller:{connected:false,reason:'TEST_SELLER_NOT_CONFIGURED'},read_only:true});
  const connections=await sql('SELECT supplier_id,provider_user_id,token_encrypted,expires_at FROM supplier_mp_connections WHERE provider_user_id=$1 LIMIT 2',[sellerId]);
  if(connections.rowCount!==1)
   return reply({configuration,seller:{connected:connections.rowCount>0,unique_connection:connections.rowCount===1,reason:connections.rowCount?'MULTIPLE_SELLER_CONNECTIONS':'SELLER_NOT_CONNECTED'},read_only:true});
  const connection=connections.rows[0];
  const report={connected:true,unique_connection:true,stored_seller_matches_allowlist:String(connection.provider_user_id)===sellerId,
   encrypted_token_readable:false,token_type_valid:false,token_not_expired:false,oauth_identity_matches:null,
   credential_error:null};
  let token;
  try{
   token=decryptSecret(connection.token_encrypted);
   report.encrypted_token_readable=true;
   report.token_type_valid=token.startsWith('APP_USR-');
  }catch{
   report.credential_error='TOKEN_DECRYPTION_FAILED';
   return reply({configuration,seller:report,preference:{checked:false,reason:'TOKEN_UNAVAILABLE'},read_only:true});
  }
  report.token_not_expired=Number.isFinite(new Date(connection.expires_at).getTime())&&new Date(connection.expires_at).getTime()>Date.now();
  if(!report.token_not_expired){
   report.credential_error='OAUTH_TOKEN_EXPIRED';
   return reply({configuration,seller:report,preference:{checked:false,reason:'TOKEN_EXPIRED'},read_only:true});
  }
  if(!report.token_type_valid){
   report.credential_error='OAUTH_TOKEN_TYPE_UNEXPECTED';
   return reply({configuration,seller:report,preference:{checked:false,reason:'TOKEN_TYPE_UNEXPECTED'},read_only:true});
  }
  try{report.oauth_identity_matches=(await oauthSellerId(token))===sellerId}
  catch(e){report.credential_error=code(e?.message)}
  if(report.oauth_identity_matches!==true)
   return reply({configuration,seller:report,preference:{checked:false,reason:'OAUTH_IDENTITY_UNVERIFIED'},read_only:true});
  const groups=await sql(`SELECT preference_id,amount_cents,marketplace_fee_cents FROM supplier_order_groups
    WHERE supplier_id=$1 AND preference_id IS NOT NULL AND created_at>=now()-interval '14 days'
    ORDER BY created_at DESC LIMIT 1`,[connection.supplier_id]);
  if(!groups.rowCount)return reply({configuration,seller:report,preference:{checked:false,reason:'NO_RECENT_PREFERENCE'},read_only:true});
  const g=groups.rows[0];
  let preference;
  try{
   const response=await fetch('https://api.mercadopago.com/checkout/preferences/'+encodeURIComponent(g.preference_id),{
    headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)
   });
   if(!response.ok)return reply({configuration,seller:report,preference:{checked:true,found:false,http_status:response.status},read_only:true});
   const pref=await response.json();
   preference={checked:true,...mpRuntimePreferenceAudit(pref,{sellerId,clientId:process.env.MP_CLIENT_ID,
    amountCents:Number(g.amount_cents),feeCents:Number(g.marketplace_fee_cents)})};
  }catch{preference={checked:true,found:false,reason:'PREFERENCE_QUERY_FAILED'}}
  return reply({configuration,seller:report,preference,read_only:true,
   note:'Auditoria somente leitura. Nao valida MP_CLIENT_SECRET nem MP_WEBHOOK_SECRET diretamente e nao renova o token OAuth.'});
 }catch(e){
  if(e?.status===401||e?.status===403)return reply({error:e.message},e.status);
  console.warn('[mp.runtime.audit.failed]',JSON.stringify({code:'RUNTIME_AUDIT_FAILED'}));
  return reply({error:'Auditoria indisponível; consulte os logs do servidor.'},503);
 }
}
