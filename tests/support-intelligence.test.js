import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSupport,classifySupport,productIntent,productAnswer,orderContext} from '../lib/support-intelligence.mjs';
import {orderQuestion,orderNumber} from '../lib/support-faq.mjs';
import {purgeSupportHistory} from '../lib/support-retention.mjs';
test('summary classification interprets informal requests without triggering commercial actions',()=>{
 assert.equal(classifySupport('qro cancelar a compra'),'Cancelamento de pedido');
 assert.equal(classifySupport('n chegou minha entega'),'Problema com a entrega');
 assert.equal(classifySupport('a camisa ficou pequena'),'Troca de tamanho');
 assert.equal(classifySupport('pg e n confirmou'),'Problema com o pagamento');
 assert.equal(classifySupport('preciso de ajuda'),'Atendimento ao cliente');
 assert.equal(normalizeSupport('vc n recebeu?'),'voce nao recebeu?');
});
test('catalog query understands color, size, budget and contextual alternatives',()=>{
 const original='tem camisa preta tamanho M até R$ 150?';
 const x=productIntent(original);
 assert.deepEqual(x,{tokens:['camisa'],color:'preto',size:'M',maxCents:15000,department:null});
 const h=[{sender_kind:'visitor',body:original},{sender_kind:'bot',body:'Resultado'},{sender_kind:'visitor',body:'e azul?'}];
 assert.deepEqual(productIntent('e tamanho G?',h),{tokens:['camisa'],color:'azul',size:'G',maxCents:15000,department:null});
 assert.equal(productIntent('quero trocar minha camisa'),null);
 assert.match(productAnswer([{name:'Camisa real',variant:'Azul',price_cents:9000,sizes:['G']}]),/90,00/);
 assert.match(productAnswer([]),/Não encontrei/);
});
test('order context keeps explicitly requested order number for follow-up',()=>{
 const h=[{sender_kind:'visitor',body:'meu pedido'},{sender_kind:'visitor',body:'123'}];
 assert.equal(orderContext('e rastreio?',h,orderNumber,orderQuestion),'123');
 assert.equal(orderContext('qual tamanho?',h,orderNumber,orderQuestion),null);
});
test('retention deletes only chat records and dedicated notifications',async()=>{
 const queries=[];const c={query:async(s,args)=>{queries.push([s,args]);return {rowCount:1,rows:s.startsWith('DELETE FROM support_threads')?[{id:'id'}]:[]}}};
 const r=await purgeSupportHistory(c);assert.equal(r.threads,1);
 assert.match(queries[0][0],/DELETE FROM support_ai_messages.*24 hours/);
 assert.match(queries[1][0],/DELETE FROM support_threads.*30 days/);
 assert.match(queries[2][0],/kind='support_requested'/);
 assert.match(queries[3][0],/DELETE FROM support_messages.*30 days/);
 assert.ok(queries.every(([q])=>!/\b(orders|payments|customer_requests|customer_request_messages)\b/.test(q)));
});
