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
