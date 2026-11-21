import {NextResponse} from 'next/server';
import {requireRole} from '@/lib/auth';
import {sql} from '@/lib/db';
import {supplierAccessToken,mpRequest} from '@/lib/marketplace';
import {ensure,fail,uuid} from '@/lib/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// Consulta SOMENTE LEITURA. Nunca cria cobranças, altera pedidos ou confirma pagamentos.
export async function GET(req){
 try{
  await requireRole(req,['super_admin']);
  ensure(process.env.MP_MODE==='sandbox','Diagnóstico disponível apenas em sandbox.',403);
  const groupId=new URL(req.url).searchParams.get('group_id');
  ensure(!groupId||uuid(groupId),'Identificador de checkout inválido.',400);
  const rows=await sql(`SELECT g.id,g.supplier_id,g.amount_cents,g.created_at,g.payment_status,
      g.preference_id,g.provider_payment_id,g.order_id,mp.provider_user_id
    FROM supplier_order_groups g
    JOIN supplier_mp_connections mp ON mp.supplier_id=g.supplier_id
    WHERE ($1::uuid IS NULL OR g.id=$1::uuid)
      AND g.created_at>=now()-interval '14 days'
    ORDER BY g.created_at DESC LIMIT 10`,[groupId||null]);
  const groups=await Promise.all(rows.rows.map(async g=>{
   const base={group_id:g.id,created_at:g.created_at,amount_cents:g.amount_cents,
      local_status:g.payment_status,preference_created:!!g.preference_id,
      provider_payment_id:g.provider_payment_id||null,order_created:!!g.order_id};
   if(!g.preference_id)return {...base,diagnosis:'Preferência não foi criada.',attempts:[]};
   try{
    const token=await supplierAccessToken(g.supplier_id);
    const params=new URLSearchParams({sort:'date_created',criteria:'desc',
      external_reference:g.id,limit:'10'});
    const found=await mpRequest('/v1/payments/search?'+params.toString(),token);
    const attempts=(Array.isArray(found.results)?found.results:[])
      .filter(p=>String(p.external_reference||'')===String(g.id))
      .slice(0,5).map(p=>({
       payment_id:String(p.id||''),status:p.status||null,status_detail:p.status_detail||null,
       created_at:p.date_created||null,payment_method:p.payment_method_id||null,
       test_payment:p.live_mode===false,
       amount_matches:Number.isFinite(Number(p.transaction_amount))&&
         Math.round(Number(p.transaction_amount)*100)===Number(g.amount_cents),
       collector_matches:String(p.collector_id||'')===String(g.provider_user_id||'')
      }));
    return {...base,attempts,diagnosis:attempts.length?'Tentativa encontrada no Mercado Pago.':'Nenhuma transação localizada para esta preferência.'};
   }catch{
    return {...base,attempts:null,diagnosis:'Consulta ao Mercado Pago falhou; verifique a conexão OAuth do fornecedor.'};
   }
  }));
  return NextResponse.json({mode:'sandbox',checked_at:new Date().toISOString(),
    groups,read_only:true},{headers:{'Cache-Control':'no-store, max-age=0','X-Robots-Tag':'noindex'}});
 }catch(e){return fail(e)}
}
