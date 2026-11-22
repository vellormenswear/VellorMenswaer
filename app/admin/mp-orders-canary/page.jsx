'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Frame from '@/components/Frame';
export default function OrdersCanary(){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[tests,setTests]=useState([]);
 useEffect(()=>{fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'})
  .then(async r=>{if(!r.ok)throw Error('Sessão indisponível');return r.json()})
  .then(x=>setUser(x.user||null)).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 const authorized=user?.role==='super_admin';
 async function create(mode){setBusy(mode);setError('');try{
  const r=await fetch('/api/admin/mp-orders-canary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Erro ao criar order.');
  setTests(v=>[{...data,result:null},...v]);
 }catch(e){setError(e.message)}finally{setBusy('')}}
 async function check(orderId){setBusy(orderId);setError('');try{
  const r=await fetch('/api/admin/mp-orders-canary?order_id='+encodeURIComponent(orderId),{cache:'no-store'});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Erro ao consultar order.');
  setTests(v=>v.map(t=>t.order_id===orderId?{...t,result:data}:t));
 }catch(e){setError(e.message)}finally{setBusy('')}}
 return <Frame user={user}><main className="page checkoutbox">
  <h1>Mercado Pago · Checkout Pro Orders API</h1>
  <p><Link href="/admin/mp-teste">Voltar ao checkout clássico</Link></p>
  <section className="card"><h2>Alternativa oficial isolada — apenas sandbox</h2>
   <p>Dois fluxos independentes de R$ 20: sem comissão e com comissão de R$ 1. Esta página usa a Orders API, não cria pedidos comerciais na VELLOR nem confirma recebimento.</p>
   <p className="notice">O checkout de teste deve ser utilizado como convidado, em janela anônima, com cartão e dados de teste. Não utilize cartão real.</p>
   {loading?<p>Verificando acesso...</p>:!authorized?<p className="notice error">Acesso exclusivo do superadministrador.</p>:
    <div className="flexrow" style={{gap:12,flexWrap:'wrap'}}>
     <button className="btn gold" disabled={!!busy} onClick={()=>create('simple')}>ORDERS SEM SPLIT</button>
     <button className="btn" disabled={!!busy} onClick={()=>create('split')}>ORDERS COM SPLIT (R$ 1)</button>
    </div>}
  </section>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {authorized&&tests.map(t=><section key={t.order_id} className="card">
   <h2>{t.mode==='split'?'Com Split':'Sem Split'} · R$ 20,00</h2>
   <p>ID da order: <code>{t.order_id}</code></p>
   <p>Estado inicial: <b>{t.status}</b></p>
   <a className="btn gold" href={t.checkout_url} target="_blank" rel="noopener noreferrer">ABRIR CHECKOUT ORDERS</a>
   <button className="btn ghost" disabled={!!busy} onClick={()=>check(t.order_id)}>CONSULTAR RESULTADO NA API</button>
   {t.result&&<details open><summary>Resultado oficial da order (sem dados pessoais)</summary>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(t.result,null,2)}</pre>
   </details>}
  </section>)}
 </main></Frame>
}
