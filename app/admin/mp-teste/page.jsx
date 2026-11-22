'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Frame from '@/components/Frame';
const money=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function IsolatedMercadoPagoTest(){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),
 [error,setError]=useState(''),[runs,setRuns]=useState([]);
 useEffect(()=>{fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json())
  .then(j=>setUser(j.user||null)).catch(()=>setError('Falha ao verificar sessao.')).finally(()=>setLoading(false));},[]);
 async function create(mode){
  setBusy(mode);setError('');
  try{
   const r=await fetch('/api/admin/mp-isolated-test',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({mode})});
   const x=await r.json();if(!r.ok)throw Error(x.error||'Falha no teste.');
   setRuns(v=>[{...x,detail:null},...v]);
  }catch(e){setError(e.message)}finally{setBusy('')}
 }
 async function check(id){
  setBusy(id);setError('');
  try{
   const r=await fetch('/api/admin/mp-isolated-test?preference_id='+encodeURIComponent(id),{cache:'no-store'});
   const x=await r.json();if(!r.ok)throw Error(x.error||'Falha ao consultar.');
   setRuns(v=>v.map(a=>a.preference_id===id?{...a,detail:x}:a));
  }catch(e){setError(e.message)}finally{setBusy('')}
 }
 return <Frame user={user}><main className="page checkoutbox">
  <h1>Mercado Pago · teste isolado</h1>
  <p><Link href="/admin">Voltar ao painel</Link></p>
  {loading?<p>Verificando acesso...</p>:user?.role!=='super_admin'?
   <p className="notice error">Acesso restrito ao superadministrador.</p>:<>
   <p className="notice">Ambiente de testes, somente para diagnostico. Nenhum pedido da VELLOR sera criado por estes testes. Use somente contas e cartoes de teste do Mercado Pago.</p>
   <section className="card"><h2>Comparar Checkout Pro</h2>
    <p>Dois testes separados de {money(2000)}, usando o mesmo vendedor OAuth de teste e o mesmo produto. Nenhum filtro de forma de pagamento, URL de retorno ou notificacao.</p>
    <div className="flexrow">
     <button className="btn" disabled={!!busy} onClick={()=>create('simple')}>1. GERAR TESTE SIMPLES (SEM SPLIT)</button>
     <button className="btn gold" disabled={!!busy} onClick={()=>create('split')}>2. GERAR TESTE COM SPLIT (R$ 1)</button>
    </div>
    <p className="small">Para isolar a falha, teste primeiro o simples e depois o Split. Geramos preferencias novas, sem alterar o checkout da loja.</p>
   </section>
   {error&&<p className="notice error" role="alert">{error}</p>}
   {runs.map(t=><section key={t.preference_id} className="card">
    <h2>{t.mode==='split'?'Com Split':'Simples'} · {money(t.amount_cents)}</h2>
    <p className="small">Preferencia: <code>{t.preference_id}</code></p>
    {t.sandbox_checkout_url?<a className="btn gold" href={t.sandbox_checkout_url} target="_blank" rel="noopener noreferrer">ABRIR CHECKOUT SANDBOX</a>:
      <p className="notice error">O Mercado Pago nao forneceu um link de sandbox valido nesta preferencia.</p>}
    <button className="btn ghost" disabled={!!busy} onClick={()=>check(t.preference_id)}>CONSULTAR RESULTADO</button>
    {t.detail&&<><p>Status: <b>{t.detail.outcome}</b></p>
     {t.detail.reason_code&&<p>Motivo Mercado Pago: <b>{t.detail.reason_code}</b></p>}
     {t.detail.merchant_orders?.map(o=><p className="small" key={o.order_id}>Ordem {o.order_id} · {o.status} · {o.order_status} · pagamentos: {o.payment_count}</p>)}
     <details><summary>Dados tecnicos sem credenciais</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(t.detail,null,2)}</pre></details>
    </>}
   </section>)}
  </>}
 </main></Frame>
}
