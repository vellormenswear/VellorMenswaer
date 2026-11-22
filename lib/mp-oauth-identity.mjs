// Mercado Pago documenta a consulta OAuth de identidade em api.mercadolibre.com/users/me.
// Nunca consultar /users/me via api.mercadopago.com (host incorreto).
// Somente devolvemos o ID público do vendedor, sem tokens ou dados da conta.
const IDENTITY_ENDPOINT='https://api.mercadolibre.com/users/me';
export async function oauthSellerId(accessToken,fetchImpl=fetch){
 if(typeof accessToken!=='string'||!accessToken.trim())throw new Error('OAUTH_TOKEN_MISSING');
 const response=await fetchImpl(IDENTITY_ENDPOINT,{
  method:'GET',headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/json'},
  cache:'no-store',signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw new Error('OAUTH_IDENTITY_HTTP_'+response.status);
 const payload=await response.json().catch(()=>null);
 if(!/^[0-9]+$/.test(String(payload?.id||'')))throw new Error('OAUTH_IDENTITY_MISSING');
 return String(payload.id);
}
