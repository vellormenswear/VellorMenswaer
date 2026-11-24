import test from 'node:test';import assert from 'node:assert/strict';import {passwordHash,passwordVerify,secureCompare} from '../lib/security.js';
test('senha segura e comparação',async()=>{const a=await passwordHash('EXEMPLO-senha-forte-2026');assert.equal(await passwordVerify('EXEMPLO-senha-forte-2026',a),true);assert.equal(await passwordVerify('senha errada',a),false);await assert.rejects(()=>passwordHash('123'))});

test('comparacao de tokens autenticados constante',()=>{assert.equal(secureCompare('abcdefgh','abcdefgh'),true);assert.equal(secureCompare('abcdefgh','12345678'),false)});

test('hash de senha truncado ou vazio é rejeitado',async()=>{assert.equal(await passwordVerify('senha','scrypt$16384$8$1$'+'a'.repeat(32)+'$'),false);assert.equal(await passwordVerify('senha','scrypt$16384$8$1$bad$'+'a'.repeat(128)),false);});
