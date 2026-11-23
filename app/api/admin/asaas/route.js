import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {ensure,fail,ok,body,originGuard,uuid} from '@/lib/http';
import {asaasApi} from '@/lib/asaas-api';
import {asaasSandboxConfigured,validWalletId,asaasPrimaryWalletId,buildAsaasCheckout,asaasUrl} from '@/lib/asaas.mjs';
import {randomUUID} from 'node:crypto';
export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function GET(req){
 try{
  await requireRole(req,['super_admin']);
  const configured=asaasSandboxConfigured(process.env);
  let connection=null,connectionError=null,primaryWallet=null;
  if(configured){
   try{
    const wallet=await asaasApi('/wallets/');
    primaryWallet=asaasPrimaryWalletId(wallet);
    connection={http_status:200,authenticated:true,primary_wallet_available:!!primaryWallet,
      wallet_response_count:Array.isArray(wallet?.data)?wallet.data.length:null};
   }catch(e){connectionError=e.message;connection={authenticated:false}}
  }
  let suppliers=[],schemaReady=false;
  try{
   const r=await sql("SELECT s.id,s.business_name,w.wallet_id FROM suppliers s LEFT JOIN supplier_asaas_wallets w ON w.supplier_id=s.id WHERE s.status='active' ORDER BY s.created_at DESC LIMIT 100");
   suppliers=r.rows;schemaReady=true;
  }catch{schemaReady=false}
  return ok({provider:'asaas',environment:'sandbox',configured,connection,connection_error:connectionError,
   schema_ready:schemaReady,webhook_token_set:!!process.env.ASAAS_WEBHOOK_TOKEN,
   checkout_enabled:process.env.ASAAS_CHECKOUT_ENABLED==='true',
   suppliers,primary_wallet_id:primaryWallet});
 }catch(e){return fail(e)}
}

export async function POST(req){
 try{
  originGuard(req);const user=await requireRole(req,['super_admin']);
  ensure(asaasSandboxConfigured(process.env),'Somente ambiente Asaas Sandbox configurado.',503);
  const x=await body(req,2000);
  ensure(['save_wallet','test_split'].includes(x.action),'Operacao desconhecida.',400);
  if(x.action==='save_wallet'){
   ensure(uuid(x.supplier_id)&&validWalletId(x.wallet_id),'Fornecedor ou walletId invalido.',400);
   const primary=await asaasApi('/wallets/');
   const own=asaasPrimaryWalletId(primary);
   ensure(validWalletId(own),'Nao foi possivel validar a carteira principal.',503);
   ensure(own.toLowerCase()!==x.wallet_id.toLowerCase(),'Fornecedor nao pode utilizar carteira da propria VELLOR.',409);
   const exists=await sql("SELECT id FROM suppliers WHERE id=$1 AND status='active'",[x.supplier_id]);
   ensure(exists.rowCount===1,'Fornecedor invalido ou suspenso.',404);
   await sql("INSERT INTO supplier_asaas_wallets(supplier_id,wallet_id,verified_by) VALUES($1,$2,$3) ON CONFLICT(supplier_id) DO UPDATE SET wallet_id=EXCLUDED.wallet_id,verified_by=EXCLUDED.verified_by,verified_at=now()",[x.supplier_id,x.wallet_id,user.id]);
   return ok({updated:true,wallet_id:x.wallet_id});
  }
  ensure(uuid(x.supplier_id),'Fornecedor invalido.',400);
  const r=await sql("SELECT w.wallet_id FROM supplier_asaas_wallets w JOIN suppliers s ON s.id=w.supplier_id WHERE s.id=$1 AND s.status='active'",[x.supplier_id]);
  ensure(r.rowCount===1,'Fornecedor nao possui walletId Asaas validado.',409);
  const own=asaasPrimaryWalletId(await asaasApi('/wallets/'));
  ensure(validWalletId(own),'Nao foi possivel validar a carteira principal.',503);
  const walletId=String(r.rows[0].wallet_id);
  ensure(own!==walletId.toLowerCase(),'Carteira principal invalida para Split.',409);
  const id=randomUUID();
  const {payload}=buildAsaasCheckout([{amount_cents:17000,supplier_amount_cents:10000,wallet_id:walletId}],
   {batchId:id,site:(process.env.SITE_URL||'https://vellormenswear.vercel.app').replace(/\/$/,'')});
  const created=await asaasApi('/checkouts',{method:'POST',data:payload});
  const link=asaasUrl(created.id);
  ensure(link,'Asaas nao retornou identificador de Checkout valido.',502);
  return ok({checkout_id:created.id,checkout_url:link,provider:'asaas',environment:'sandbox',
   amount_cents:17000,supplier_cents:10000,store_cents_before_fees:7000,
   confirmed:false,note:'Checkout diagnostico: nao cria pedido VELLOR, confirma pagamento nem debita estoque.'},201);
 }catch(e){return fail(e)}
}
