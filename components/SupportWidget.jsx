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
 async function send(action,quick){
  if(sending)return;
  const msg=(quick||input).trim();
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
 return <><link rel="stylesheet" href="/vellor-support.css?v=20261124-support-v2"/><div className="vellor-support">
  <button type="button" className="vellor-support-fab" aria-label="Abrir atendimento VELLOR" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <span className="vellor-support-fab-icon"><svg className="vellor-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 11.4a8.2 8.2 0 0 1-8.4 8H7l-4 2v-5A8.5 8.5 0 1 1 20.5 11.4Z"/><path d="M8 11h8M8 14h5"/></svg></span>
  </button>
  {open&&<section className="vellor-support-panel" aria-label="Atendimento VELLOR">
   <header className="vellor-support-head"><div><strong>Atendimento VELLOR</strong><small>Orientações e suporte</small></div><button type="button" aria-label="Fechar atendimento" onClick={()=>setOpen(false)}>×</button></header>
   <div className="vellor-support-messages" role="log" aria-live="polite">
    {!messages.length&&<p className="vellor-support-info">Olá! Sou o assistente VELLOR. Como posso ajudar você hoje? Escolha um assunto ou escreva sua dúvida.</p>}
    {!messages.length&&<div className="vellor-support-topics">{["Como comprar?","Qual o prazo de entrega?","Acompanhar meu pedido","Pagamentos e Pix","Trocas e devoluções"].map(t=><button type="button" key={t} disabled={sending} onClick={()=>send('message',t)}>{t}</button>)}</div>}
    {messages.map(m=><article key={m.id} className={'vellor-support-bubble '+m.sender_kind}><small>{senderLabel(m)} · {new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small><span>{m.body}</span></article>)}
    <div ref={endRef}/>
   </div>
   {(chatStatus==='bot'||chatStatus==='closed')&&<div className="vellor-support-actions"><button disabled={sending} type="button" onClick={()=>send('request_human')}>Falar com um atendente</button></div>}
   <p className="vellor-support-status">E-mail: <a href="mailto:contato@vellormenswear.com.br">contato@vellormenswear.com.br</a></p>
   <form id="vellor-support-form" onSubmit={e=>{e.preventDefault();send('message')}}><label className="vellor-support-sr" htmlFor="vellor-support-input">Sua mensagem</label><input id="vellor-support-input" maxLength={1200} placeholder="Digite sua dúvida..." value={input} onChange={e=>setInput(e.target.value)} required/><button type="submit" aria-label="Enviar mensagem" disabled={sending}>➤</button></form>
   <p role="status" className="vellor-support-status">{notice|| (chatStatus==='waiting'?'Atendimento solicitado · aguardando resposta':chatStatus==='active'?'Conversa com a equipe VELLOR':'Atendimento automático')}</p>
  </section>}
 </div></>;
}
