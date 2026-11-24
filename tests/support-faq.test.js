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
