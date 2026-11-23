import test from 'node:test';
import assert from 'node:assert/strict';
import {supportReply} from '../lib/support-faq.mjs';
test('prazo nao e inventado',()=>{const r=supportReply('qual o prazo da entrega?');assert.match(r,/fornecedor/);assert.doesNotMatch(r,/\d+ dias/);});
test('passos para comprar sem prometer checkout ativo',()=>{const r=supportReply('como comprar?');assert.match(r,/carrinho/);assert.match(r,/quando os pedidos estiverem habilitados/);});
test('dados sensiveis nunca sao solicitados',()=>{assert.match(supportReply('pagamento com cartao'),/não recebe dados de cartão/);});
