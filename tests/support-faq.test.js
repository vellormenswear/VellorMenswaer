import test from 'node:test';
import assert from 'node:assert/strict';
import {supportReply} from '../lib/support-faq.mjs';
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
