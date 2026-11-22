// Split 1:N (Checkout Transparente via Orders API): VELLOR = owner;
// fornecedores = partners identificados por consentimentos ACTIVE.
// Funcoes puras: nao executam cobrancas nem acessam segredos.
const uuidRE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idRE=/^[0-9]{3,20}$/;
const referenceRE=/^vellor-primary-1n-test-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const asMoney=c=>(c/100).toFixed(2);
const cents=n=>{
 if(typeof n!=='string'&&typeof n!=='number')return null;
 const v=Number(n);
 return Number.isFinite(v)&&v>=0&&Number.isSafeInteger(Math.round(v*100))?Math.round(v*100):null;
};
export const validReceiverId=value=>typeof value==='string'&&uuidRE.test(value);
export const validPrimaryOrderId=value=>typeof value==='string'&&/^ORDTST[A-Z0-9]{10,64}$/.test(value);

export function primarySplitSandboxReady(env){
 return env?.MP_MODE==='sandbox' && env.MP_LIVE_ENABLED!=='true' &&
  env.MP_PRIMARY_1N_ENABLED==='true' && env.MP_PRIMARY_1N_APPROVED==='true' &&
  !!env.MP_TEST_ACCESS_TOKEN && idRE.test(String(env.MP_PRIMARY_TEST_SELLER_USER_ID||'')) &&
  validReceiverId(env.MP_SECONDARY_TEST_RECEIVER_ID) &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(env.MP_SANDBOX_TEST_CUSTOMER_EMAIL||''));
}

// Nao utilizar marketplace_fee: neste modelo a conta principal e a vendedora,
// e o fornecedor e recebedor secundario (partner) por consentimento ativo.
export function primarySplitPlan({ownerId,totalCents,partners}){
 if(!idRE.test(String(ownerId||''))||!Number.isSafeInteger(totalCents)||totalCents<1)
  throw new Error('Vendedor principal ou valor invalido');
 if(!Array.isArray(partners)||partners.length<1||partners.length>10)
  throw new Error('O split exige de 1 a 10 fornecedores');
 const seen=new Set();
 let cost=0;
 const entries=partners.map(p=>{
  const id=String(p?.receiverId||'');
  if(!validReceiverId(id)||seen.has(id.toLowerCase())||
     !Number.isSafeInteger(p?.amountCents)||p.amountCents<1)
   throw new Error('Fornecedor, consentimento ou custo invalido');
  seen.add(id.toLowerCase());cost+=p.amountCents;
  if(!Number.isSafeInteger(cost))throw new Error('Soma dos custos invalida');
  return {receiver_id:id,receiver_type:'partner',amount:asMoney(p.amountCents),description:'Fornecedor VELLOR'};
 });
 const ownerAmount=totalCents-cost;
 if(ownerAmount<1)throw new Error('A parcela da VELLOR deve ser positiva');
 return {totalCents,ownerCents:ownerAmount,supplierCents:cost,
  splits:[{receiver_id:String(ownerId),receiver_type:'owner',amount:asMoney(ownerAmount),description:'VELLOR vendedora principal'},...entries]};
}

export function primarySplitPixPayload({plan,reference,payerEmail}){
 if(!plan||!Number.isSafeInteger(plan.totalCents)||!referenceRE.test(String(reference||''))||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payerEmail||'')))
  throw new Error('Plano, referencia ou comprador de teste invalidos');
 return {
  type:'online',processing_mode:'automatic',external_reference:reference,
  total_amount:asMoney(plan.totalCents),
  payer:{email:payerEmail,first_name:'APRO',last_name:'Test',entity_type:'individual',
   identification:{type:'CPF',number:'12345678909'}},
  transactions:{payments:[{amount:asMoney(plan.totalCents),
   payment_method:{id:'pix',type:'bank_transfer'},expiration_time:'P1D'}]},
  config:{split_rules:{amount_type:'fixed'}},
  splits:plan.splits.map(s=>({...s})),
  items:[{title:'Teste VELLOR Split 1:N',quantity:1,unit_price:asMoney(plan.totalCents)}]
 };
}

export function hasActiveConsent(payload,receiverId){
 return Array.isArray(payload?.results)&&payload.results.some(c=>
  String(c?.receiver_id||'').toLowerCase()===String(receiverId||'').toLowerCase()&&c?.status==='ACTIVE');
}

export function inspectPrimarySplitOrder(order,{plan,reference,clientId}={}){
 const actual=order?.splits;
 const expected=plan?.splits||[];
 const splitMatches=Array.isArray(actual)&&actual.length===expected.length&&
  expected.every(e=>actual.filter(a=>String(a?.receiver_id).toLowerCase()===String(e.receiver_id).toLowerCase() &&
    a?.receiver_type===e.receiver_type && cents(a?.amount)===cents(e.amount)).length===1);
 const appId=order?.integration_data?.application_id;
 const checks={
  sandbox_order:validPrimaryOrderId(order?.id),
  reference_matches:String(order?.external_reference||'')===String(reference||'')&&referenceRE.test(String(reference||'')),
  currency_matches:order?.currency==='BRL',
  total_matches:cents(order?.total_amount)===plan?.totalCents,
  split_matches:splitMatches,
  primary_seller_matches:order?.user_id==null?null:String(order.user_id)===String(expected[0]?.receiver_id||''),
  application_matches:appId==null?null:String(appId)===String(clientId||'')
 };
 const safe=checks.sandbox_order&&checks.reference_matches&&checks.currency_matches&&
  checks.total_matches&&checks.split_matches&&checks.primary_seller_matches!==false&&checks.application_matches!==false;
 return {safe,checks,status:typeof order?.status==='string'?order.status:null,
  status_detail:typeof order?.status_detail==='string'?order.status_detail:null,
  approved:safe&&order?.status==='processed'&&order?.status_detail==='accredited'};
}
