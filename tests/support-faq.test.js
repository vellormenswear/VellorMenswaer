import test from 'node:test';
import assert from 'node:assert/strict';
import {supportReply,orderQuestion,orderNumber,humanQuestion} from '../lib/support-faq.mjs';
test('envio em até 3 dias, entrega distinta e sem menção aos operadores',()=>{
 const r=supportReply('qual o prazo da entrega?');
 assert.match(r,/envio em até 3 dias/);
 assert.match(r,/prazo de entrega é diferente/);
 assert.doesNotMatch(r,/fornecedor|repasse|dropshipping/i);
});
test('direito de arrependimento informado em devoluções',()=>{
 const r=supportReply('quero devolver meu pedido');
 assert.match(r,/7 dias corridos/);
 assert.match(r,/Minha Conta/);
 assert.match(r,/Trocas e Devoluções/);
});
test('passos para comprar sem prometer checkout ativo',()=>{
 const r=supportReply('como comprar?');
 assert.match(r,/carrinho/);
 assert.match(r,/quando os pedidos estiverem habilitados/);
});
test('dados sensíveis nunca são solicitados',()=>{
 assert.match(supportReply('pagamento com cartao'),/não recebe dados completos de cartão/);
});

test('assistente reconhece múltiplas dúvidas, contexto e atendimento humano',()=>{assert.match(supportReply('oi'),/Olá/);assert.match(supportReply('aceita pix e qual prazo de entrega?'),/Pix/);assert.match(supportReply('aceita pix e qual prazo de entrega?'),/3 dias/);assert.match(supportReply('quanto tempo?', [{sender_kind:'visitor',body:'qual a entrega?'}]),/3 dias/);assert.equal(orderQuestion('acompanhar meu pedido'),true);assert.equal(orderNumber('pedido #123'), '123');assert.equal(humanQuestion('quero falar com um atendente'),true);assert.doesNotMatch(supportReply('qual o meu pedido?'),/fornecedor|repasse/i);});

import {readFileSync} from 'node:fs';
test('solicitações têm histórico, titularidade e ações administrativas distintas de estorno',()=>{const route=readFileSync('app/api/requests/chat/route.js','utf8'),ui=readFileSync('components/RequestConversations.jsx','utf8'),admin=readFileSync('app/admin/page.jsx','utf8'),client=readFileSync('app/conta/page.jsx','utf8'),support=readFileSync('app/api/support/chat/route.js','utf8');assert.ok(route.includes('requireRole(req,roles)')&&route.includes('r.user_id=$2 AND o.customer_id=$2')&&route.includes('FOR UPDATE OF r'));assert.ok(route.includes('customer_request_messages')&&!route.includes('UPDATE payments'));assert.ok(ui.includes('role="log"')&&ui.includes('5000'));assert.ok(admin.includes('<SupportInbox initialId={supportId} refreshToken={supportRefresh}/>')&&admin.includes('<RequestConversations admin initialId={requestChatId} refreshToken={supportRefresh}/>'));assert.ok(client.includes('<RequestConversations initialId={requestId} onSelect={setRequestId}/>'));assert.ok(support.includes('WHERE customer_id=$1 AND order_number=$2::bigint')&&support.includes('const HUMAN_OWNER=')&&support.includes('t.customer_id=$1::uuid')&&support.includes('customer_id IS NULL AND t.guest_owner_hash=$2'));});

test('assistente orienta troca de tamanho antes da postagem sem prometer alteração automática',()=>{const r=supportReply('Gostaria de trocar o tamanho da camisa');assert.match(r,/antes da postagem/);assert.match(r,/tamanho estiver disponível/);assert.match(r,/Aguarde a confirmação/);});

test('chamado contínuo permanece no pedido e mantém histórico após encerramento',()=>{const route=readFileSync('app/api/requests/chat/route.js','utf8'),ui=readFileSync('components/RequestConversations.jsx','utf8'),client=readFileSync('app/conta/page.jsx','utf8'),account=readFileSync('app/api/account/[resource]/route.js','utf8');assert.ok(route.includes('AND id<$2::bigint')&&route.includes('has_more:messages.rows.length>100')&&route.includes("!['resolved','rejected'].includes(t.status)"));assert.ok(ui.includes('Carregar mensagens anteriores')&&ui.includes('combine(prev?.thread?.id===id?prev.messages:[]')&&ui.includes('Chamado encerrado.')&&ui.includes('orderId&&!admin&&!active'));assert.ok(client.includes('orderId={selected.order.id}')&&!client.includes('ENVIAR SOLICITAÇÃO'));assert.ok(account.includes('FOR UPDATE')&&account.includes('Já existe um chamado em andamento')&&account.includes('INSERT INTO customer_request_messages'));});

test('atualizações incrementais e encerramentos registram a continuidade do chamado',()=>{const route=readFileSync('app/api/requests/chat/route.js','utf8'),ui=readFileSync('components/RequestConversations.jsx','utf8'),cancel=readFileSync('lib/admin-order-cancel.js','utf8');assert.ok(route.includes('AND id>$2::bigint')&&route.includes('ORDER BY id ASC LIMIT 101'));assert.ok(ui.includes('while(info.has_more&&info.messages.length)')&&ui.includes('newest.current'));assert.ok(cancel.includes('WITH changed AS (UPDATE customer_requests')&&cancel.includes("SELECT id,'admin','Reembolso confirmado.' FROM changed"));});
