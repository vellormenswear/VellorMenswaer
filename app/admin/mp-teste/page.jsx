'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Frame from '@/components/Frame';
const money=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function IsolatedMercadoPagoTest(){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),
 [error,setError]=useState(''),[runs,setRuns]=useState([]);
 useEffect(()=>{
  fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'})
   .then(async r=>{if(!r.ok)throw new Error('Nao foi possivel consultar sua sessao.');return r.json()})
   .then(j=>setUser(j.user||null))
   .catch(()=>setError('Falha ao verificar a sessao. Atualize a pagina ou entre novamente na conta administrativa.'))
   .finally(()=>setLoading(false));
 },[]);
 const authorized=user?.role==='super_admin';
 async function create(mode){
  if(!authorized){setError('Entre com a conta superadministradora para gerar preferencias de teste.');return;}
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
  <section className="card">
   <h2>Comparar Checkout Pro</h2>
   <p>Dois testes de {money(2000)}, com o mesmo vendedor OAuth de teste e o mesmo produto. O primeiro nao inclui Split; o segundo utiliza uma comissao isolada de R$ 1.</p>
   <div className="flexrow" style={{gap:12,flexWrap:'wrap'}}>
    <button type="button" className="btn gold" disabled={loading||!authorized||!!busy} onClick={()=>create('simple')}>GERAR TESTE SIMPLES (SEM SPLIT)</button>
    <button type="button" className="btn" disabled={loading||!authorized||!!busy} onClick={()=>create('split')}>GERAR TESTE COM SPLIT (R$ 1)</button>
   </div>
   {loading?<p className="notice">Verificando acesso para habilitar os botoes...</p>:
    !authorized?<div className="notice error" role="status">
      Os botoes estao visiveis, mas desabilitados porque esta sessao nao foi reconhecida como superadministradora.
      {user?<p>Perfil identificado: <b>{user.role}</b>. Entre com uma conta <b>super_admin</b>.</p>:
       <p>Voce nao esta autenticado nesta sessao. Entre na VELLOR para habilitar os testes.</p>}
      <p><Link href="/conta">ENTRAR / TROCAR DE CONTA</Link></p>
     </div>:
     <p className="notice">Acesso confirmado: superadministrador. Use primeiro o teste simples, depois o Split.</p>}
   <p className="small">Essas preferencias nao criam pedidos na VELLOR. Use apenas dados e cartoes de teste do Mercado Pago.</p>
  </section>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {authorized&&<>
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
