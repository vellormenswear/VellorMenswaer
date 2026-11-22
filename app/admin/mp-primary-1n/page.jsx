'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Frame from '@/components/Frame';

export default function PrimarySplit1NCanary(){
 const [user,setUser]=useState(null),[state,setState]=useState(null),[error,setError]=useState(''),
  [busy,setBusy]=useState(''),[consent,setConsent]=useState(null),[orders,setOrders]=useState([]);
 useEffect(()=>{
  Promise.all([
   fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'}),
   fetch('/api/admin/mp-primary-1n-canary',{cache:'no-store',credentials:'same-origin'})
  ]).then(async ([auth,res])=>{
   const a=await auth.json().catch(()=>({})),b=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(b.error||'Acesso restrito ao superadministrador.');
   setUser(a.user||null);setState(b);
  }).catch(e=>setError(e.message));
 },[]);
 async function act(action){
  setBusy(action);setError('');
  try{
   const r=await fetch('/api/admin/mp-primary-1n-canary',{
    method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
    body:JSON.stringify({action})
   });
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.error||'Operacao de teste recusada.');
   if(action==='create_consent')setConsent(data);
   else setOrders(prev=>[data,...prev]);
  }catch(e){setError(e.message)}finally{setBusy('')}
 }
 async function check(x){
  setBusy(x.order_id);setError('');
  try{
   const query=new URLSearchParams({order_id:x.order_id,reference:x.reference});
   const r=await fetch('/api/admin/mp-primary-1n-canary?'+query,{credentials:'same-origin',cache:'no-store'});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.error||'Nao foi possivel consultar a order.');
   setOrders(prev=>prev.map(o=>o.order_id===x.order_id?{...o,result:data}:o));
  }catch(e){setError(e.message)}finally{setBusy('')}
 }
 return <Frame user={user}><main className="page checkoutbox">
  <h1>VELLOR principal · Split 1:N (sandbox)</h1>
  <p><Link href="/admin">Voltar ao painel</Link></p>
  <section className="card">
   <h2>Modelo correto de recebimento</h2>
   <p>Comprador paga <b>R$ 170,00</b>. A <b>VELLOR</b> é a vendedora principal (owner) e recebe R$ 70,00;
    o fornecedor secundário (partner) recebe R$ 100,00, antes das tarifas do Mercado Pago.</p>
   <p>Este experimento utiliza Checkout Transparente via Orders API com Pix. Não é Checkout Pro, não utiliza
    marketplace_fee e não cria pedidos ou lançamentos financeiros comerciais da VELLOR.</p>
   <p className="notice">O Mercado Pago restringe o Split 1:N a integrações comercialmente habilitadas.
    Antes disso, a operação permanece bloqueada. Não utilize contas ou recursos reais nesta tela.</p>
   {state?<div>
    <p>Ambiente: <b>{state.sandbox?'Sandbox':'Indisponível'}</b> · Experimento: <b>{state.enabled?'Habilitado':'Bloqueado'}</b></p>
    <p>Credencial principal: {state.token_set?'Configurada':'Pendente'} · Owner ID: {state.owner_set?'Configurado':'Pendente'} ·
     Receiver consentido: {state.consent_set?'Configurado':'Pendente'} · Pronto: {state.ready?'Sim':'Não'}</p>
   </div>:<p>Verificando pré-requisitos...</p>}
   <div className="flexrow" style={{gap:12,flexWrap:'wrap'}}>
    <button className="btn" onClick={()=>act('create_consent')} disabled={!!busy||!state?.enabled||!state?.token_set||!state?.owner_set||!state?.partner_email_set}>
     CRIAR CONSENTIMENTO DE TESTE
    </button>
    <button className="btn gold" onClick={()=>act('pix')} disabled={!!busy||!state?.ready}>
     GERAR TESTE PIX 1:N
    </button>
   </div>
   {consent&&<p role="status">Consentimento {consent.status}. Receiver ID: <code>{consent.receiver_id}</code>.
    Esse UUID deverá ser configurado no servidor antes de criar o pagamento.</p>}
  </section>
  {error&&<p role="alert" className="notice error">{error}</p>}
  {orders.map(o=><section className="card" key={o.order_id}>
   <h2>Order {o.order_id}</h2>
   <p>Estado: <b>{o.result?.status||o.status}</b> · Detalhe: {o.result?.status_detail||o.status_detail||'Indisponível'}</p>
   <p>Confirmação de pagamento: <b>{o.result?.approved?'Aprovado pela API':'Ainda não confirmada'}</b></p>
   {(o.result?.ticket_url||o.ticket_url)&&<p><a className="btn" href={o.result?.ticket_url||o.ticket_url}
    target="_blank" rel="noopener noreferrer">ABRIR PAGAMENTO PIX DE TESTE</a></p>}
   <button className="btn ghost" disabled={!!busy} onClick={()=>check(o)}>CONSULTAR RESULTADO OFICIAL</button>
   {o.result&&<details><summary>Auditoria de valores e recebedores</summary>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(o.result.checks,null,2)}</pre>
   </details>}
  </section>)}
 </main></Frame>;
}
