/* VELLOR checkout telemetry: no credentials, addresses, payment data or query strings. */
(function(){
 'use strict';
 const key='vellor-checkout-trace-v1';
 let id=null;
 try{id=sessionStorage.getItem(key)}catch{}
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id||'')){
  id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():null;
  try{if(id)sessionStorage.setItem(key,id)}catch{}
 }
 function send(stage,level,code,message,metadata){
  if(!id)return;
  const body=JSON.stringify({trace_id:id,stage,level:level||'info',
   code:code||stage,message:message?String(message).slice(0,300):undefined,metadata:metadata||{}});
  try{fetch('/api/checkout-traces',{method:'POST',headers:{'Content-Type':'application/json'},
   body,credentials:'same-origin',keepalive:true,cache:'no-store'}).catch(()=>{})}catch{}
 }
 window.VellorTrace={
  id,
  event:(stage,metadata)=>send(stage,'info',stage,null,metadata),
  success:(stage,metadata)=>send(stage,'success',stage,null,metadata),
  error:(stage,code,message,metadata)=>send(stage,'error',code,message,metadata),
  warning:(stage,code,message,metadata)=>send(stage,'warning',code,message,metadata)
 };
 window.addEventListener('error',function(e){
  if(e?.target&&e.target!==window)return;
  send('client.error','error','CLIENT_EXCEPTION',e?.message||'Erro no navegador',{});
 });
 window.addEventListener('unhandledrejection',function(e){
  send('client.promise_rejection','error','UNHANDLED_REJECTION',
   typeof e?.reason?.message==='string'?e.reason.message:'Promessa rejeitada sem motivo legivel',{});
 });
})();
