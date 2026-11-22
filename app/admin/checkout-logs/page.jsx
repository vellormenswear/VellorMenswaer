'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Frame from '@/components/Frame';
export default function CheckoutLogs(){
 const [user,setUser]=useState(null),[loaded,setLoaded]=useState(false);
 const [trace,setTrace]=useState(''),[errors,setErrors]=useState(false),
 [events,setEvents]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function reload(filter=trace,onlyErrors=errors){
  setBusy(true);setError('');
  try{
   const q=new URLSearchParams();
   if(filter)q.set('trace_id',filter.trim());
   if(onlyErrors)q.set('errors','true');
   const r=await fetch('/api/admin/checkout-traces?'+q,{cache:'no-store'});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Nao foi possivel consultar os registros.');
   setEvents(j.events||[]);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 useEffect(()=>{
  fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json()).then(j=>{
   setUser(j.user||null);
   if(['admin','super_admin'].includes(j.user?.role)){
    const p=new URLSearchParams(window.location.search);
    const id=p.get('trace_id')||'';
    setTrace(id);reload(id,false);
   }
  }).catch(()=>setError('Sessao nao identificada.')).finally(()=>setLoaded(true));
 },[]);
 const authorized=['admin','super_admin'].includes(user?.role);
 return <Frame user={user}><main className="page" style={{maxWidth:1120,margin:'0 auto'}}>
  <h1>Registro de compra · Diagnostico</h1>
  <p><Link href="/admin">Voltar ao administrativo</Link></p>
  <p className="small">Etapas de produto, carrinho, checkout, Mercado Pago e confirmacao. Dados tecnicos no Neon e nos logs de execucao da Vercel. Nenhum numero de cartao, senha ou token e armazenado.</p>
  {!loaded?<p>Consultando acesso...</p>:!authorized?<p className="notice error">Apenas ADM e Super ADM podem consultar os registros.</p>:<>
   <section className="card">
    <h2>Filtrar ocorrencias</h2>
    <div className="flexrow" style={{gap:10,flexWrap:'wrap'}}>
     <input className="form" style={{minWidth:260,flex:1}} placeholder="Codigo do rastreamento (UUID), opcional" value={trace} onChange={e=>setTrace(e.target.value)}/>
     <label><input type="checkbox" checked={errors} onChange={e=>setErrors(e.target.checked)}/> So alertas e erros</label>
     <button className="btn gold" disabled={busy} onClick={()=>reload()}>ATUALIZAR REGISTROS</button>
     <button className="btn ghost" onClick={()=>{setTrace('');setErrors(false);reload('',false)}}>LIMPAR FILTROS</button>
     <button className="btn ghost" onClick={()=>navigator.clipboard?.writeText(JSON.stringify(events,null,2))}>COPIAR JSON SEGURO</button>
    </div>
    <p className="small">Ate 300 eventos recentes (ultimos 30 dias). Se houver falha de armazenamento, os eventos ainda aparecem temporariamente nos logs da Vercel.</p>
   </section>
   {error&&<p className="notice error" role="alert">{error}</p>}
   <section className="card"><h2>Eventos ({events.length})</h2>
    {!events.length?<p>Nenhum evento encontrado para esse filtro.</p>:events.map(e=><div key={e.id} className="card" style={{padding:12,marginBottom:8}}>
     <div className="flexrow" style={{gap:10,flexWrap:'wrap',alignItems:'center'}}>
      <b>{e.stage}</b><span className="tag">{e.level.toUpperCase()}</span><span className="small">{e.code}</span>
      <span className="spacer"/><span className="small">{new Date(e.created_at).toLocaleString('pt-BR')}</span>
     </div>
     {e.message&&<p>{e.message}</p>}
     <p className="small">Rastreamento: <code>{e.trace_id}</code>
      {e.http_status&&<> · HTTP {e.http_status}</>}
      {e.group_id&&<> · Grupo {e.group_id}</>}
      {e.preference_id&&<> · Preferencia {e.preference_id}</>}
     </p>
     {Object.keys(e.metadata||{}).length>0&&<details><summary>Metadados tecnicos</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(e.metadata,null,2)}</pre></details>}
     <button className="btn ghost" type="button" onClick={()=>{setTrace(e.trace_id);reload(e.trace_id,errors)}}>VER TODA A TENTATIVA</button>
    </div>)}
   </section>
  </>}
 </main></Frame>
}
