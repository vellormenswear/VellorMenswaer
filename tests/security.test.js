import test from 'node:test';import assert from 'node:assert/strict';import {passwordHash,passwordVerify,verifyMPWebhook} from '../lib/security.js';import {createHmac} from 'node:crypto';
test('senha segura e comparação',async()=>{const a=await passwordHash('EXEMPLO-senha-forte-2026');assert.equal(await passwordVerify('EXEMPLO-senha-forte-2026',a),true);assert.equal(await passwordVerify('senha errada',a),false);await assert.rejects(()=>passwordHash('123'))});
test('assinatura mercado pago válida e inválida',()=>{const secret='teste',ts=String(Date.now()),dataId='ORDTST123456789',requestId='r123';const msg=`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;const sig=`ts=${ts},v1=${createHmac('sha256',secret).update(msg).digest('hex')}`;assert.equal(verifyMPWebhook({secret,signature:sig,requestId,dataId}),true);assert.equal(verifyMPWebhook({secret,signature:sig,requestId,dataId:'ORDTST999999999'}),false)});

test('webhook Mercado Pago aceita espacos entre os campos da assinatura sem enfraquecer HMAC',()=>{
 const secret='integration-test',ts=String(Date.now());
 const dataId='123456789',requestId='d12da9b7';
 const manifest=`id:${dataId};request-id:${requestId};ts:${ts};`;
 const hmac=createHmac('sha256',secret).update(manifest).digest('hex');
 assert.equal(verifyMPWebhook({secret,signature:`ts=${ts}, v1=${hmac}`,requestId,dataId}),true);
 assert.equal(verifyMPWebhook({secret,signature:` ts = ${ts} , v1 = ${hmac} `,requestId,dataId}),true);
 assert.equal(verifyMPWebhook({secret,signature:`ts=${ts}, v1=${hmac}`,requestId:'attacker',dataId}),false);
});
