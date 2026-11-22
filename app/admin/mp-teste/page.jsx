'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Frame from '@/components/Frame';
const money=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function IsolatedMercadoPagoTest(){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),
 [error,setError]=useState(''),[runs,setRuns]=useState([]),[copied,setCopied]=useState('');
 useEffect(()=>{
  fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'})
   .then(async r=>{if(!r.ok)throw new Error('Nao foi possivel consultar sua sessao.');return r.json()})
   .then(j=>setUser(j.user||null))
   .catch(()=>setError('Falha ao verificar a sessao. Atualize a pagina ou entre novamente na conta administrativa.'))
   .finally(()=>setLoading(false));
 },[]);
 const authorized=user?.role==='super_admin'||user?.role==='admin';
 async function create(mode){
  if(!authorized){setError('Entre com uma conta administradora ou superadministradora para gerar preferencias de teste.');return;}
  setBusy(mode);setError('');
  try{
   const r=await fetch('/api/admin/mp-isolated-test',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,trace_id:window.VellorTrace?.id||null})});
   const x=await r.json();if(!r.ok)throw Error(x.error||'Falha no teste.');
   setRuns(v=>[{...x,detail:null},...v]);
  }catch(e){setError(e.message)}finally{setBusy('')}
 }
 function markOpened(id){
  setRuns(v=>v.map(t=>t.preference_id===id?{...t,opened_at:new Date().toISOString()}:t));
 }
 function markObserved(id,host){
  setRuns(v=>v.map(t=>t.preference_id===id?{...t,observed_host:host}:t));
 }
 async function copyDiagnostic(t){
  const safe={
   preference_id:t.preference_id,mode:t.mode,
   checkout_field_used:'init_point',
   checkout_initial_host:t.checkout_initial_host||null,
   browser_observed_host:t.observed_host||'nao_conferido',
   checkout_opened_at:t.opened_at||null,
   creation_diagnostic:t.creation_diagnostic||null,
   payment_diagnostic:t.detail||null
  };
  try{await navigator.clipboard.writeText(JSON.stringify(safe,null,2));setCopied('Relatorio tecnico copiado sem URLs completas nem tokens.');}
  catch{setCopied('Nao foi possivel copiar automaticamente. Abra os detalhes tecnicos para consultar os campos seguros.');}
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
      Os botoes estao visiveis, mas desabilitados porque esta sessao nao foi reconhecida como administradora ou superadministradora.
      {user?<p>Perfil identificado: <b>{user.role}</b>. Entre com uma conta <b>admin</b> ou <b>super_admin</b>.</p>:
       <p>Voce nao esta autenticado nesta sessao. Entre na VELLOR para habilitar os testes.</p>}
      <p><Link href="/conta">ENTRAR / TROCAR DE CONTA</Link></p>
     </div>:
     <p className="notice">Acesso administrativo confirmado. Use primeiro o teste simples, depois o Split.</p>}
   <p className="small">Preferencias sem pedidos comerciais. O Checkout Pro utiliza init_point mesmo com vendedores APP_USR de teste. Use somente contas e cartoes de teste, nunca meios de pagamento reais.</p>
  </section>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {copied&&<p className="notice" role="status">{copied}</p>}
  {authorized&&<>
   {runs.map(t=><section key={t.preference_id} className="card">
    <h2>{t.mode==='split'?'Com Split':'Simples'} · {money(t.amount_cents)}</h2>
    <p className="small">Preferencia: <code>{t.preference_id}</code>{t.trace_id&&<> · Rastreamento: <code>{t.trace_id}</code></>}</p>
    {t.checkout_url?<a className="btn gold" href={t.checkout_url} target="_blank" rel="noopener noreferrer" onClick={()=>markOpened(t.preference_id)}>ABRIR CHECKOUT DE TESTE (INIT_POINT)</a>:
      <p className="notice error">O Mercado Pago nao forneceu um init_point valido nesta preferencia.</p>
    <p className="small">Link enviado: <b>init_point</b> · Dominio inicial: <b>{t.checkout_initial_host||'Nao retornado'}</b></p>
    {t.creation_diagnostic&&<details><summary>Resposta da criacao da preferencia (dados seguros)</summary>
      <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(t.creation_diagnostic,null,2)}</pre></details>}
    <div className="field"><label htmlFor={'mp-host-'+t.preference_id}>Dominio que voce viu no navegador depois de abrir o checkout</label>
     <select id={'mp-host-'+t.preference_id} value={t.observed_host||''} onChange={e=>markObserved(t.preference_id,e.target.value)}>
      <option value="">Ainda nao conferi</option>
      <option value="sandbox.mercadopago.com.br">sandbox.mercadopago.com.br</option>
      <option value="www.mercadopago.com.br">www.mercadopago.com.br</option>
      <option value="outro">Outro dominio do Mercado Pago</option>
     </select>
     <p className="small">Confira o endereco no navegador, sem copiar a URL completa: ela pode conter codigos e tokens temporarios. O servidor nao consegue ver redirecionamentos internos de outro site.</p></div>
    <button className="btn ghost" disabled={!!busy} onClick={()=>check(t.preference_id)}>CONSULTAR RESULTADO</button>
    <button className="btn ghost" type="button" onClick={()=>copyDiagnostic(t)}>COPIAR RELATORIO TECNICO</button>
    {t.detail&&<><p>Status: <b>{t.detail.outcome}</b></p>
     {t.detail.outcome_explanation&&<p className="notice">{t.detail.outcome_explanation}</p>}
     {t.detail.reason_code&&<p>Motivo Mercado Pago: <b>{t.detail.reason_code}</b></p>}
     {t.detail.merchant_orders?.map(o=><p className="small" key={o.order_id}>Ordem {o.order_id} · {o.status} · {o.order_status} · pagamentos: {o.payment_count}</p>)}
     <details><summary>Dados tecnicos sem credenciais</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(t.detail,null,2)}</pre></details>
    </>}
   </section>)}
  </>}
 </main></Frame>
}
