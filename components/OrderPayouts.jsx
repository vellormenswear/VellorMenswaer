'use client';
import {useState,useRef} from 'react';
const brl=x=>(Number(x||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function OrderPayouts({groups,onRecorded}){
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[reference,setReference]=useState({}),[notes,setNotes]=useState({}),[copied,setCopied]=useState('');
 const lock=useRef(false);
 async function record(g){
  if(lock.current||!g.pix_ready||!g.pix_updated_at)return;
  if(!confirm('Confirma que já enviou '+brl(g.supplier_amount_cents)+' ao titular '+g.pix_holder_name+' e conferiu o comprovante?'))return;
  lock.current=true;setBusy(g.group_id);setError('');
  try{const r=await fetch('/api/admin/infinitepay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'record_payout',group_id:g.group_id,transfer_reference:reference[g.group_id]||'',notes:notes[g.group_id]||'',pix_updated_at:g.pix_updated_at})});const j=await r.json();if(!r.ok||j.recorded!==true)throw Error(j.error||'Falha ao registrar Pix');await onRecorded?.();}
  catch(e){setError(e.message)}finally{lock.current=false;setBusy('')}
 }
 if(!groups?.length)return null;
 return <section className="card"><h3>Repasse ao fornecedor</h3>{error&&<p role="alert" className="notice error">{error}</p>}{groups.map(g=><div className="card" key={g.group_id}><div className="flexrow"><b>{g.business_name}</b><strong>{brl(g.supplier_amount_cents)}</strong></div>{g.transfer_reference?<p>Pix registrado: {g.transfer_reference}</p>:g.pix_ready?<>{g.qr&&<img src={g.qr} alt="QR Code Pix do fornecedor" width="224" height="224" style={{maxWidth:'100%',height:'auto'}}/>}{(g.code||g.pix_key)&&<button className="tiny" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(g.code||g.pix_key);setCopied(g.group_id);setTimeout(()=>setCopied(id=>id===g.group_id?'':id),1800)}catch{setError('Não foi possível copiar o código.')}}}>{copied===g.group_id?'COPIADO':g.code?'COPIAR PIX':'COPIAR CHAVE PIX'}</button>}<p>{g.pix_holder_name} · <code style={{overflowWrap:'anywhere'}}>{g.pix_key}</code></p><div className="field"><label>Referência do Pix enviado (obrigatória)</label><input value={reference[g.group_id]||''} onChange={e=>setReference(x=>({...x,[g.group_id]:e.target.value}))}/></div><div className="field"><label>Data, destinatário e comprovante conferido</label><textarea value={notes[g.group_id]||''} onChange={e=>setNotes(x=>({...x,[g.group_id]:e.target.value}))}/></div><button type="button" className="btn gold" disabled={!!busy||!g.pix_ready||!g.pix_updated_at} onClick={()=>record(g)}>REGISTRAR PIX JÁ REALIZADO</button></>:<p>{g.fulfillment_status==='awaiting_payout'?'Chave Pix pendente':({paid:'Repasse confirmado',preparing:'Em preparação',shipped:'Enviado',delivered:'Entregue',canceled:'Cancelado'}[g.fulfillment_status]||'Em acompanhamento')}</p>}</div>)}</section>
}
