import test from 'node:test';
import assert from 'node:assert/strict';
import {oauthSellerId} from '../lib/mp-oauth-identity.mjs';
test('usa endpoint oficial de identidade OAuth e retorna apenas ID validado',async()=>{
 let url,options;
 const id=await oauthSellerId('test-token',async(u,o)=>{url=u;options=o;return {ok:true,json:async()=>({id:3854288750,email:'private'})}});
 assert.equal(url,'https://api.mercadolibre.com/users/me');
 assert.equal(options.headers.Authorization,'Bearer test-token');
 assert.equal(id,'3854288750');
});
test('falha fechada com ID ausente ou resposta HTTP ruim',async()=>{
 await assert.rejects(()=>oauthSellerId('token',async()=>({ok:true,json:async()=>({id:'error'})})),/OAUTH_IDENTITY_MISSING/);
 await assert.rejects(()=>oauthSellerId('token',async()=>({ok:false,status:401})),/OAUTH_IDENTITY_HTTP_401/);
});
