'use client';
import {useEffect,useState} from 'react';import Link from 'next/link';import Frame from '@/components/Frame';
const money=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const trace=(stage,meta)=>window.VellorTrace?.event(stage,meta||{});
const traceOk=(stage,meta)=>window.VellorTrace?.success(stage,meta||{});
const traceError=(stage,code,message,meta)=>window.VellorTrace?.error(stage,code,message,meta||{});
const labels={pending:'Aguardando pagamento',approved:'Pago e confirmado',refunded:'Reembolsado',refund_pending:'Reembolso em análise',rejected:'Não aprovado',refund_failed:'Falha no reembolso'};
export default function GroupCheckout(){const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[providerResult,setProviderResult]=useState(null);
 const load=async()=>{try{const params=new URLSearchParams(location.search);const checkout=params.get('checkout_id')||params.get('order_nsu')||(!params.get('order_id')?sessionStorage.getItem('vellor-last-checkout-id'):null);
  const order=params.get('order_id');if(!checkout&&!order)throw Error('Nenhuma tentativa de pagamento selecionada.');
  const query=checkout?'checkout_id='+encodeURIComponent(checkout):'order_id='+encodeURIComponent(order);
  trace('checkout.groups.opened',{phase:'refresh'});let r=await fetch('/api/infinitepay/groups?'+query,{cache:'no-store',headers:{'X-Vellor-Trace-ID':window.VellorTrace?.id||''}});let j=await r.json();
  if(!r.ok)throw Error(j.error);setData(j);setError('');traceOk('checkout.groups.loaded',{group_count:j.groups.length});
  if(j.groups.length&&j.groups.every(g=>g.payment_status==='approved')){
   const saved=sessionStorage.getItem('vellor-last-checkout-cart');const current=localStorage.getItem('goston-cart-preview');
   if(saved&&saved===current&&sessionStorage.getItem('vellor-last-checkout-id')===j.checkout_id)localStorage.removeItem('goston-cart-preview');
   try{const attempt=JSON.parse(sessionStorage.getItem('vellor-checkout-attempt')||'null');if(attempt?.checkout_id===j.checkout_id)sessionStorage.removeItem('vellor-checkout-attempt')}catch{}
  }
 }catch(e){traceError('checkout.groups.failed','GROUP_QUERY_FAILED',e.message);setError(e.message)}};
 useEffect(()=>{
  load();
  const params=new URLSearchParams(location.search);
  const transaction_nsu=params.get('transaction_nsu'),slug=params.get('slug');
  const checkout_id=params.get('checkout_id')||params.get('order_nsu')||sessionStorage.getItem('vellor-last-checkout-id');
  // O retorno do navegador nao comprova pagamento. A verificacao sempre ocorre no servidor
  // e exige o payment_check oficial. E executada uma unica vez nesta abertura.
  if(transaction_nsu&&slug&&checkout_id){
   setBusy(true);
   fetch('/api/infinitepay/recheck-payment',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({checkout_id,transaction_nsu,slug})})
    .then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Falha na verificacao InfinitePay');return j})
    .then(j=>{setProviderResult({group_id:null,...j});return load()})
    .catch(e=>{traceError('payment.failed','RETURN_RECHECK_FAILED',e.message);setError(e.message)})
    .finally(()=>setBusy(false));
  }
  const id=setInterval(load,20000);return()=>clearInterval(id)
 },[]);
 async function checkProvider(id){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/infinitepay/recheck-payment',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({checkout_id:data?.checkout_id,transaction_nsu:new URLSearchParams(location.search).get('transaction_nsu')||'',slug:new URLSearchParams(location.search).get('slug')||'',trace_id:window.VellorTrace?.id||null})
   });
   const x=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(x.error||'Não foi possível conferir o pagamento na API.');
   setProviderResult({group_id:id,...x});if(x.result==='AWAITING_PROVIDER_REFERENCES'){setError('Aguardando as referências oficiais do pagamento. Consulte novamente após a confirmação.');return;}
   traceOk('payment.status',{status:x.provider_status||x.result||'checked'});
   await load();
  }catch(e){traceError('payment.failed','PAYMENT_RECHECK_FAILED',e.message);setError(e.message)}
  finally{setBusy(false)}
 }
 async function retry(id){try{setBusy(true);const r=await fetch('/api/infinitepay/retry-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checkout_id:data?.checkout_id,trace_id:window.VellorTrace?.id||null})});const j=await r.json();if(!r.ok)throw Error(j.error);if(!j.checkout_url?.startsWith('https://'))throw Error('Link inválido.');trace('payment.redirect',{checkout_mode:'standard'});window.location.assign(j.checkout_url)}catch(e){traceError('payment.failed','RETRY_PREFERENCE_FAILED',e.message);setError(e.message);setBusy(false)}}
 return <Frame user={null}><main className="page checkoutbox"><h1>Acompanhe seus pagamentos</h1>
 <p>Sua compra é acompanhada pela VELLOR em uma única cobrança. <b>O pedido é confirmado somente após a aprovação do pagamento.</b> O envio é providenciado em até 3 dias após a confirmação; acompanhe o andamento na sua conta.</p>
 {providerResult?.group_id===null&&<p className="notice" role="status">Conferência automática: <b>{providerResult.confirmed?'Pagamento confirmado pelo provedor':'Aguardando confirmação oficial'}</b></p>}
 {error&&<p className="notice error" role="alert">{error} · Rastreamento: <code>{window.VellorTrace?.id||'indisponivel'}</code></p>}
 {!data?<p>Consultando pagamentos...</p>:<section className="card"><h2>Acompanhamento do checkout</h2>
 {data.groups.map((g,index)=><div className="card" key={g.id}><div className="flexrow"><b>Pagamento {index+1}</b><span className="spacer"/><strong>{money(g.amount_cents)}</strong></div>
 <p>Status: <b>{labels[g.payment_status]||g.payment_status}</b>{g.order_number&&<> · Pedido #{g.order_number}</>}</p>
 {g.payment_status==='pending'&&<div style={{marginBottom:12}}>
   <button className="btn ghost" disabled={busy} type="button" onClick={()=>checkProvider(g.id)}>VERIFICAR PAGAMENTO</button>
   <p className="small">Consulta a API do provedor e verifica pagamentos sem depender de webhook. Nao gera nova cobranca.</p>
  </div>}
 {providerResult?.group_id===g.id&&<p className="notice" role="status">Retorno do provedor: <b>{providerResult.result||'NAO_DETERMINADO'}</b>
  {providerResult.provider_status&&<> · status: {providerResult.provider_status}</>}
  {providerResult.status_detail&&<> · detalhe: {providerResult.status_detail}</>}
  {providerResult.reason&&<> · {providerResult.reason}</>}
 </p>}
 {g.payment_status==='pending'&&(!g.checkout_expires_at||new Date(g.checkout_expires_at)>new Date())&&(g.checkout_url?<a className="btn gold" href={g.checkout_url} onClick={()=>trace('payment.redirect',{checkout_mode:'standard'})}>CONTINUAR PAGAMENTO</a>:<button className="btn gold" disabled={busy} onClick={()=>retry(g.id)}>GERAR LINK DE PAGAMENTO</button>)}
 {g.payment_status==='pending'&&g.checkout_expires_at&&new Date(g.checkout_expires_at)<=new Date()&&<p className="notice error">Este checkout expirou. Se você já pagou, verifique o pagamento ou fale com o atendimento antes de tentar novamente.</p>}
 {g.payment_status==='pending'&&g.checkout_expires_at&&<p className="small">Link válido até {new Date(g.checkout_expires_at).toLocaleString('pt-BR')}.</p>}
 {g.payment_status==='refund_pending'&&<p className="notice error">Pagamento recebido, mas há uma pendência que exige verificação administrativa. Não será enviado antes de ser resolvido.</p>}
 {g.tracking_code&&<p className="small">Rastreio: {g.carrier} — {g.tracking_code}</p>}</div>)}
 <button className="btn ghost" onClick={load}>ATUALIZAR SITUAÇÃO</button>
 <p className="help">A página de retorno não confirma pagamentos. A VELLOR consulta o provedor e registra seu pedido somente após a aprovação oficial. Você pode acompanhar a compra em Minha Conta.</p></section>}
 <p><Link href="/conta">Consultar meus pedidos pagos</Link></p></main></Frame>
}
