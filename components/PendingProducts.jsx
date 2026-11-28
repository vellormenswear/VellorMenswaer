'use client';
import {useEffect,useState,useRef} from 'react';
import GroupedReview from '@/components/GroupedReview';
import groupedStyles from './GroupedVariants.module.css';
import {variantAvailable} from '@/lib/stock-availability.mjs';
import {parseRetailPriceCents} from '@/lib/marketplace-rules.mjs';
const brl=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const call=async(method,path,data)=>{const r=await fetch('/api/'+path,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Falha na operação');return j};
export default function PendingProducts({onChanged,refreshToken}){
 const [data,setData]=useState(null),[legacy,setLegacy]=useState(null),[changes,setChanges]=useState([]),[msg,setMsg]=useState(''),[prices,setPrices]=useState({}),[slugs,setSlugs]=useState({}),[supplierId,setSupplierId]=useState(''),[legacyCost,setLegacyCost]=useState({}),[busy,setBusy]=useState(false),[reviewNotice,setReviewNotice]=useState({}),[loading,setLoading]=useState(true);
 const request=useRef(0),lock=useRef(false);
 async function load(){
  const current=++request.current;setLoading(true);setMsg('');
  try{
   const diag=await call('POST','admin/marketplace-status',{});
   if(!diag.ready)throw Error('Banco de dados ainda não preparado para o marketplace. Falta aplicar: '+diag.missing_migrations.join(', '));
   const [s,l,c]=await Promise.all([call('GET','suppliers/admin-list?view=pending'),call('GET','suppliers/admin-legacy'),call('GET','suppliers/admin-price-requests')]);
   if(current!==request.current)return false;
   setData(s);setLegacy(l);setChanges(c.requests||[]);setSupplierId(old=>s.suppliers.some(supplier=>supplier.id===old)?old:(s.suppliers[0]?.id||''));return true;
  }catch(e){if(current===request.current){setData(null);setMsg(e.message)}return false}
  finally{if(current===request.current)setLoading(false)}
 }
 useEffect(()=>{load();return()=>{request.current++}},[refreshToken]);
 async function post(action,payload){
  if(lock.current)return null;lock.current=true;setBusy(true);setMsg('');
  try{const r=await call('POST','suppliers/'+action,payload);const refreshed=await load();if(refreshed)setMsg('Operação registrada.');await onChanged?.();return r}
  catch(e){setMsg(e.message);return null}finally{lock.current=false;setBusy(false)}
 }
 async function reviewSubmission(s,decision,note=''){
  if(lock.current)return;lock.current=true;
  setBusy(true);
  setReviewNotice(prev=>({...prev,[s.id]:{status:'processing',text:decision==='approved'?'Aprovando anúncio...':'Rejeitando anúncio...'}}));
  try{
   const payload={id:s.id,decision,note,revision:s.revision};
   if(decision==='approved'){
    payload.slug=slugs[s.id]||'';
    payload.prices=Object.fromEntries(s.variants.map(v=>[v.sku,parseRetailPriceCents(prices[s.id+':'+s.revision]?.[v.sku])]));
   }
   await call('POST','suppliers/admin-review',payload);
   const noPhoto=s.variants.some(v=>!String(v.image_url||'').trim());
   const soldOut=s.variants.every(v=>!variantAvailable(v));
   const text=decision==='rejected'?'Anúncio rejeitado.':
    'Anúncio aprovado e publicado.'+(noPhoto?' Foi aplicada a imagem provisória.':'')+
    (soldOut?' Todas as variações estão indisponíveis e não aparecerão na vitrine até a disponibilidade ser confirmada.':'');
   setReviewNotice(prev=>({...prev,[s.id]:{status:'success',text}}));
   const refreshed=await load();if(refreshed)setMsg(text);await onChanged?.();
  }catch(error){
   setReviewNotice(prev=>({...prev,[s.id]:{status:'error',text:error?.message||'Não foi possível concluir a análise.'}}));
  }finally{lock.current=false;setBusy(false)}
 }
 return <div className={groupedStyles.scope} aria-label="Gestão de produtos pendentes">
 {msg&&<p role="status" aria-live="polite" className="notice">{msg}</p>}
 {loading?<section className="card"><p role="status">Carregando produtos pendentes...</p></section>:!data?<section className="card"><p>Não foi possível carregar as pendências.</p><button type="button" className="btn ghost" onClick={load}>Tentar novamente</button></section>:<><section className="card"><h2>Anúncios para revisão</h2>{data.queue.filter(s=>s.status==='pending').length===0&&<p>Nenhum anúncio aguardando.</p>}{data.queue.filter(s=>s.status==='pending').map(s=><div className="card" key={s.id}><div className="flexrow"><b>{s.name}</b><small>{s.business_name} · {({pending:'Aguardando aprovação',approved:'Aprovado',rejected:'Rejeitado',inactive:'Inativo'}[s.status]||s.status)}</small></div><p className="small">{s.description}</p>{s.status==='pending'?<><div className="field"><label>Slug público (opcional)</label><input value={slugs[s.id]||''} placeholder="Gerado automaticamente" onChange={e=>setSlugs(v=>({...v,[s.id]:e.target.value}))}/></div><GroupedReview key={s.id+':'+s.revision} variants={s.variants} prices={prices[s.id+':'+s.revision]||{}} onPrices={patch=>setPrices(old=>({...old,[s.id+':'+s.revision]:{...(old[s.id+':'+s.revision]||{}),...patch}}))}/><div className="flexrow"><button type="button" className="btn gold" disabled={busy} onClick={()=>reviewSubmission(s,'approved')}>{busy&&reviewNotice[s.id]?.status==='processing'?'PROCESSANDO...':'APROVAR E PUBLICAR'}</button><button type="button" className="btn ghost" disabled={busy} onClick={()=>{const note=prompt('Motivo da reprovação:');if(note!==null)reviewSubmission(s,'rejected',note)}}>REJEITAR</button></div></>:<p className="small">{s.admin_note||'Análise finalizada.'}</p>}{reviewNotice[s.id]&&<p role="status" aria-live="polite" className="notice">{reviewNotice[s.id].text}</p>}</div>)}{data.queue.some(s=>s.status!=='pending')&&<details><summary>Histórico de análises concluídas</summary>{data.queue.filter(s=>s.status!=='pending').map(s=><div className="card" key={s.id}><div className="flexrow"><b>{s.name}</b><small>{s.business_name} · {({approved:'Aprovado',rejected:'Rejeitado',inactive:'Inativo'}[s.status]||s.status)}</small></div><p className="small">{s.description}</p><p className="small">{s.admin_note||'Análise finalizada.'}</p>{reviewNotice[s.id]&&<p role="status" aria-live="polite" className="notice">{reviewNotice[s.id].text}</p>}</div>)}</details>}</section><section className="card"><h2>Solicitações de alteração de preço do fornecedor</h2>{changes.filter(x=>x.status==='pending').length===0&&<p>Sem solicitações pendentes.</p>}{changes.filter(x=>x.status==='pending').map(c=><div key={c.id} className="rowitems"><span><b>{c.business_name}</b><br/>{c.sku} — {c.label}<br/>Atual: {brl(c.supplier_cost_cents)} → Novo: {brl(c.requested_cost_cents)}<br/><small>Venda: {brl(c.price_cents)}</small></span><div><button className="tiny" disabled={busy} onClick={()=>post('admin-price-review',{id:c.id,decision:'approved'})}>APROVAR</button> <button className="tiny danger" disabled={busy} onClick={()=>post('admin-price-review',{id:c.id,decision:'rejected'})}>REJEITAR</button></div></div>)}</section><section className="card"><h2>Associar anúncios antigos a fornecedores</h2><p className="small">Há {data.unlinked_variants} variações sem fornecedor. Os 104 anúncios históricos não são alterados automaticamente.</p><div className="field"><label>Fornecedor</label><select value={supplierId} onChange={e=>setSupplierId(e.target.value)}>{data.suppliers.map(s=><option value={s.id} key={s.id}>{s.business_name}</option>)}</select></div><div className="tablewrap"><table><thead><tr><th>Produto / SKU</th><th>Venda</th><th>Fornecimento R$</th><th>Vincular</th></tr></thead><tbody>{(legacy?.variants||[]).map(v=><tr key={v.variant_id}><td>{v.name} — {v.sku}</td><td>{brl(v.price_cents)}</td><td><input className="form" style={{width:110}} placeholder="Ex.: 80,00" value={legacyCost[v.variant_id]||''} onChange={e=>setLegacyCost(z=>({...z,[v.variant_id]:e.target.value}))}/></td><td><button className="tiny" disabled={busy||!supplierId} onClick={()=>post('admin-assign-legacy',{supplier_id:supplierId,variant_id:v.variant_id,cost_cents:Math.round(Number(String(legacyCost[v.variant_id]||'').replace(',','.'))*100),stock_mode:'availability'})}>VINCULAR</button></td></tr>)}</tbody></table></div></section></>}
 </div>
}
