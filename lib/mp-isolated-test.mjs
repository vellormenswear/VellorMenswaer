// Preferencias de diagnostico nao sao pedidos e nao devem participar da conciliacao.
export const ISOLATED_TEST_TITLE='Produto de teste VELLOR';
export const ISOLATED_TEST_CENTS=2000;
export function isolatedPreferencePayload(mode){
 if(!['simple','split'].includes(mode))throw new Error('Modo de teste invalido.');
 const data={items:[{title:ISOLATED_TEST_TITLE,quantity:1,currency_id:'BRL',unit_price:20.00}]};
 if(mode==='split')data.marketplace_fee=1.00; // Apenas comparacao de sandbox: R$1 de comissao.
 return data;
}
export function isIsolatedTestPreference(p,sellerId){
 if(!p||String(p.collector_id||'')!==String(sellerId||''))return false;
 if(!Array.isArray(p.items)||p.items.length!==1)return false;
 const i=p.items[0];
 return String(i.title||'')===ISOLATED_TEST_TITLE&&Number(i.quantity)===1&&
  String(i.currency_id||'BRL')==='BRL'&&Math.round(Number(i.unit_price)*100)===ISOLATED_TEST_CENTS &&
  [0,100].includes(Math.round(Number(p.marketplace_fee||0)*100));
}
export function getTestMode(p){return Number(p.marketplace_fee||0)>0?'split':'simple'}

// Retorna apenas o dominio, sem parametros de checkout ou tokens de sessao.
export function safeHost(url){
 try{const x=new URL(url);return x.protocol==='https:'?x.hostname.toLowerCase():null}catch{return null}
}
// Campos permitidos do POST /checkout/preferences e do resultado do Mercado Pago.
export function safeCreationDiagnostic({request={},preference={},meta={},sellerId='',mode='simple'}={}){
 const items=Array.isArray(request.items)?request.items:[];
 const providerItems=Array.isArray(preference.items)?preference.items:[];
 const total=a=>Math.round(a.reduce((n,i)=>n+Number(i.unit_price||0)*Number(i.quantity||0),0)*100);
 const requestedFee=Math.round(Number(request.marketplace_fee||0)*100);
 const providerFee=Math.round(Number(preference.marketplace_fee||0)*100);
 return {
  request:{
   item_count:items.length,total_cents:total(items),
   marketplace_fee_cents:requestedFee,
   marketplace_fee_sent:Object.prototype.hasOwnProperty.call(request,'marketplace_fee'),
   payment_methods_filtered:Object.prototype.hasOwnProperty.call(request,'payment_methods'),
   back_urls_configured:Object.prototype.hasOwnProperty.call(request,'back_urls'),
   notification_url_configured:Object.prototype.hasOwnProperty.call(request,'notification_url')
  },
  response:{
   id:String(preference.id||''),
   init_point_host:safeHost(preference.init_point),
   sandbox_init_point_host:safeHost(preference.sandbox_init_point),
   returned_item_total_cents:providerItems.length?total(providerItems):null,
   item_total_matches:providerItems.length?total(providerItems)===total(items):null,
   marketplace_fee_matches:providerFee===requestedFee,
   collector_matches_test_seller:String(preference.collector_id||'')===String(sellerId),
   provider_live_mode:typeof preference.live_mode==='boolean'?preference.live_mode:null,
   http_status:meta.http_status||null,request_id:meta.request_id||null
  },
  mode,server_mode:'sandbox',credential_type:'OAuth APP_USR',checkout_field_used:'sandbox_init_point',
  note:'O site da VELLOR confirma o link inicial, nao o dominio depois de redirecionamentos feitos pelo Mercado Pago.'
 }
}
