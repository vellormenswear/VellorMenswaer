// VELLOR — API oficial Asaas, sandbox exclusivo até homologação explícita.
const SANDBOX='https://api-sandbox.asaas.com/v3';
const WALLET=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validWalletId=v=>typeof v==='string'&&WALLET.test(v);
export const asaasSandboxConfigured=env=>env?.ASAAS_BASE_URL===SANDBOX&&
 typeof env?.ASAAS_API_KEY==='string'&&env.ASAAS_API_KEY.trim().length>15;
export function asaasReady(env,user){
 if(!asaasSandboxConfigured(env)||env.ASAAS_CHECKOUT_ENABLED!=='true'||
   !(typeof env.ASAAS_WEBHOOK_TOKEN==='string'&&env.ASAAS_WEBHOOK_TOKEN.length>=32)||
   !/^https:\/\//.test(env.SITE_URL||'')||!env.DATABASE_URL)return false;
 if(user?.role!=='customer')return false;
 // O sandbox nunca abre a loja ao publico.
 const allow=String(env.ASAAS_SANDBOX_TEST_CUSTOMER_EMAIL||'').trim().toLowerCase();
 return !!allow&&String(user.email||'').trim().toLowerCase()===allow;
}
export const asaasUrl=id=>validWalletId(id)?'https://asaas.com/checkoutSession/show?id='+encodeURIComponent(id):null;
export function buildAsaasCheckout(groups,{batchId,site}={}){
 if(!validWalletId(batchId)||!Array.isArray(groups)||groups.length<1||groups.length>20||
  !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(site||''))throw Error('Dados do checkout invalidos');
 let total=0,cost=0;const seen=new Set();
 const items=groups.map((g,i)=>{
  const amount=g.amount_cents,part=g.supplier_amount_cents,wallet=g.wallet_id;
  if(!Number.isSafeInteger(amount)||amount<1||!Number.isSafeInteger(part)||part<1||
    !validWalletId(wallet)||seen.has(wallet.toLowerCase()))throw Error('Fornecedor sem carteira valida ou valor incorreto');
  seen.add(wallet.toLowerCase());total+=amount;cost+=part;
  return {name:('Produtos da VELLOR — grupo '+(i+1)),quantity:1,value:Number((amount/100).toFixed(2))};
 });
 if(!Number.isSafeInteger(total)||!Number.isSafeInteger(cost)||cost>=total)throw Error('O valor de fornecimento deve ser inferior ao valor da venda e cobrir taxas');
 const splits=groups.map(g=>({walletId:g.wallet_id,fixedValue:Number((g.supplier_amount_cents/100).toFixed(2))}));
 const back=site+'/pagamento/grupos?checkout_id='+encodeURIComponent(batchId);
 return {payload:{billingTypes:['PIX','CREDIT_CARD'],chargeTypes:['DETACHED'],minutesToExpire:120,
    externalReference:batchId,
    callback:{successUrl:back,cancelUrl:back,expiredUrl:back},items,splits},
   total_cents:total,supplier_cents:cost,split_count:splits.length};
}
export function paidAsaasPayment(pay,expectedCheckoutId,expectedTotal){
 if(!pay||!['RECEIVED','CONFIRMED','RECEIVED_IN_CASH'].includes(pay.status))return false;
 if(String(pay.checkoutSession||'')!==String(expectedCheckoutId||''))return false;
 if(pay.deleted===true||pay.refunded===true)return false;
 return Math.round(Number(pay.value)*100)===expectedTotal&&Number.isSafeInteger(expectedTotal);
}
