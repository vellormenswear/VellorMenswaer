'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';import Frame from '@/components/Frame';
const brl=x=>(Number(x||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function InfinitepayAdmin(){
 const [u,setU]=useState(null),[data,setData]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState(''),[reference,setReference]=useState({}),[notes,setNotes]=useState({});
 async function refresh(){try{
  const [auth,r]=await Promise.all([fetch('/api/auth/me',{cache:'no-store'}),fetch('/api/admin/infinitepay',{cache:'no-store'})]);
  const a=await auth.json(),j=await r.json();if(!r.ok)throw Error(j.error||'Sem permissao');
  setU(a.user);setData(j);setErr('');
 }catch(e){setErr(e.message)}}
 useEffect(()=>{refresh()},[]);
 async function record(g){if(!confirm('O Pix ja foi efetivamente enviado ao fornecedor e o comprovante conferido? Esta acao nao faz a transferencia.'))return;
  setBusy(g.id);setErr('');
  try{const r=await fetch('/api/admin/infinitepay',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'record_payout',group_id:g.id,transfer_reference:reference[g.id]||'',notes:notes[g.id]||''})});
   const x=await r.json();if(!r.ok)throw Error(x.error||'Falha ao registrar Pix');await refresh();
  }catch(e){setErr(e.message)}finally{setBusy('')}}
 return <Frame user={u}><main className="page checkoutbox"><p><Link href="/admin">Voltar à administração</Link></p>
  <h1>InfinitePay · Repasses manuais</h1>
  <section className="card"><p>Checkout: <b>{data?.checkout_enabled?'Habilitado para cliente autorizado':'Bloqueado até homologação'}</b></p>
  <p>Credenciais: <b>{data?.configured?'Configuradas':'Aguardando InfiniteTag ou chave'}</b>.</p>
  <p className="help">O cadastro abaixo NÃO transfere dinheiro. Envie o Pix diretamente pelo seu banco ou aplicativo InfinitePay, confira os dados do beneficiário e só depois registre a referência do comprovante.</p>
  <button className="btn ghost" onClick={refresh}>ATUALIZAR</button></section>
  {err&&<p className="notice error" role="alert">{err}</p>}
  {!data?<p>Carregando...</p>:<section className="card"><h2>Pagamentos confirmados</h2>
   {(data.groups||[]).length===0&&<p>Sem pedidos InfinitePay pagos.</p>}
   {(data.groups||[]).map(g=><div className="card" key={g.id}>
    <p><b>{g.business_name}</b> · Pedido #{g.order_number}</p>
    <p>Venda: {brl(g.amount_cents)} · Repasse ao fornecedor: <b>{brl(g.supplier_amount_cents)}</b></p>
    <p>Pagamento: {g.payment_status} · Preparação: {g.fulfillment_status}</p>
    {g.transfer_reference?<p className="notice ok">Pix registrado: {g.transfer_reference}</p>:
    g.fulfillment_status==='awaiting_payout'?<>
     <div className="field"><label>Referência do Pix enviado (obrigatória)</label><input value={reference[g.id]||''} onChange={e=>setReference(x=>({...x,[g.id]:e.target.value}))}/></div>
     <div className="field"><label>Data, destinatário e comprovante conferido</label><textarea value={notes[g.id]||''} onChange={e=>setNotes(x=>({...x,[g.id]:e.target.value}))}/></div>
     <button className="btn gold" disabled={!!busy} onClick={()=>record(g)}>REGISTRAR PIX JÁ REALIZADO</button>
    </>:<p>Acompanhamento financeiro indisponível para este status.</p>}
   </div>)}</section>}
 </main></Frame>
}
