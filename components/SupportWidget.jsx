'use client';
import {useEffect,useRef,useState} from 'react';
const senderLabel=m=>m.sender_kind==='visitor'?'Você':m.sender_kind==='admin'?'Equipe VELLOR'+(m.sender_name?' · '+m.sender_name:''):'Assistente VELLOR';
export default function SupportWidget(){
 const [open,setOpen]=useState(false),[messages,setMessages]=useState([]),[chatStatus,setChatStatus]=useState('bot'),[input,setInput]=useState(''),[notice,setNotice]=useState(''),[sending,setSending]=useState(false);
 const loading=useRef(false),endRef=useRef(null);
 async function load(){
  if(loading.current)return;
  loading.current=true;
  try{
   const r=await fetch('/api/support/chat',{cache:'no-store',credentials:'same-origin'});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(d.error||'Não foi possível consultar o atendimento.');
   setMessages(d.messages||[]);setChatStatus(d.status||'bot');setNotice('');
  }catch(e){setNotice(e.message)}
  finally{loading.current=false}
 }
 useEffect(()=>{if(!open)return;load();const t=setInterval(()=>{if(!document.hidden)load()},10000);return()=>clearInterval(t)},[open]);
 useEffect(()=>{if(open)endRef.current?.scrollIntoView({block:'end',behavior:'instant'})},[open,messages]);
 async function send(action){
  if(sending)return;
  const msg=input.trim();
  if(action==='message'&&!msg)return;
  setSending(true);setNotice('Enviando...');
  try{
   const r=await fetch('/api/support/chat',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action,message:msg})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(d.error||'Não foi possível enviar a mensagem.');
   setMessages(d.messages||[]);setChatStatus(d.status||'bot');setInput('');
   setNotice(d.status==='waiting'?'Solicitação enviada aos administradores. Acompanhe por aqui.':d.status==='active'?'Conversa com a equipe VELLOR':'Atendimento automático');
  }catch(e){setNotice(e.message)}finally{setSending(false)}
 }
 return <><link rel="stylesheet" href="/vellor-support.css?v=1"/><div className="vellor-support">
  <button type="button" className="vellor-support-fab" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Atendimento <span aria-hidden="true">✦</span></button>
  {open&&<section className="vellor-support-panel" aria-label="Atendimento VELLOR">
   <header className="vellor-support-head"><div><strong>Atendimento VELLOR</strong><small>Orientações e suporte</small></div><button type="button" aria-label="Fechar atendimento" onClick={()=>setOpen(false)}>×</button></header>
   <div className="vellor-support-messages" role="log" aria-live="polite">
    {!messages.length&&<p className="vellor-support-info">Olá! Posso ajudar com prazos, como comprar, tamanhos, pagamentos e trocas. Para falar com nossa equipe, use o botão abaixo.</p>}
    {messages.map(m=><article key={m.id} className={'vellor-support-bubble '+m.sender_kind}><small>{senderLabel(m)}</small><span>{m.body}</span></article>)}
    <div ref={endRef}/>
   </div>
   {(chatStatus==='bot'||chatStatus==='closed')&&<div className="vellor-support-actions"><button disabled={sending} type="button" onClick={()=>send('request_human')}>Falar com um atendente</button></div>}
   <form onSubmit={e=>{e.preventDefault();send('message')}}><label className="vellor-support-sr" htmlFor="vellor-support-react-input">Sua mensagem</label><input id="vellor-support-react-input" maxLength={1200} placeholder="Digite sua dúvida..." value={input} onChange={e=>setInput(e.target.value)} required/><button type="submit" aria-label="Enviar mensagem" disabled={sending}>➤</button></form>
   <p role="status" className="vellor-support-status">{notice|| (chatStatus==='waiting'?'Atendimento solicitado · aguardando resposta':chatStatus==='active'?'Conversa com a equipe VELLOR':'Atendimento automático')}</p>
  </section>}
 </div></>;
}
