'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Frame from '@/components/Frame';
export default function OrdersCanary(){
 const [user,setUser]=useState(null),[storeStatus,setStoreStatus]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[tests,setTests]=useState([]);
 useEffect(()=>{
  Promise.all([
   fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}),
   fetch('/api/store/status',{credentials:'same-origin',cache:'no-store'})
  ]).then(async ([auth,store])=>{
   if(!auth.ok||!store.ok)throw Error('Não foi possível validar a conta de teste.');
   const [a,b]=await Promise.all([auth.json(),store.json()]);
   setUser(a.user||null);setStoreStatus(b);
  }).catch(e=>setError(e.message)).finally(()=>setLoading(false));
 },[]);
 const authorized=user?.role==='super_admin'||
  (user?.role==='customer'&&storeStatus?.mode==='sandbox'&&storeStatus?.orders_open===true);
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
  <p><Link href="/conta">Voltar à conta VELLOR</Link></p>
  <section className="card"><h2>Alternativa oficial isolada — apenas sandbox</h2>
   <p>Dois fluxos independentes de R$ 20: sem comissão e com comissão de R$ 10. Esta página usa a Orders API, não cria pedidos comerciais na VELLOR nem confirma recebimento.</p>
   <p className="notice">Entre na VELLOR com a conta compradora de teste autorizada. No checkout do Mercado Pago, utilize apenas meios de pagamento de teste, preferencialmente como convidado em janela anônima. Não utilize cartão real.</p>
   {loading?<p>Verificando acesso...</p>:!authorized?<p className="notice error">Acesso permitido somente à conta compradora de teste autorizada ou ao superadministrador. Verifique sua sessão e o modo sandbox.</p>:
    <div className="flexrow" style={{gap:12,flexWrap:'wrap'}}>
     <button className="btn gold" disabled={!!busy} onClick={()=>create('simple')}>ORDERS SEM SPLIT</button>
     <button className="btn" disabled={!!busy} onClick={()=>create('split')}>ORDERS COM SPLIT (R$ 10)</button>
    </div>}
  </section>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {authorized&&tests.map(t=><section key={t.order_id} className="card">
   <h2>{t.mode==='split'?'Com Split · Comissão R$ 10,00':'Sem Split'} · R$ 20,00</h2>
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
