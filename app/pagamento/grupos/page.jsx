'use client';
import {useEffect,useState} from 'react';import Link from 'next/link';
const money=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const trace=(stage,meta)=>window.VellorTrace?.event(stage,meta||{});
const traceOk=(stage,meta)=>window.VellorTrace?.success(stage,meta||{});
const traceError=(stage,code,message,meta)=>window.VellorTrace?.error(stage,code,message,meta||{});
const labels={pending:'Aguardando pagamento',approved:'Pago e confirmado',refunded:'Reembolsado',refund_pending:'Reembolso em análise',rejected:'Não aprovado',refund_failed:'Falha no reembolso'};
export default function GroupCheckout(){const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[providerResult,setProviderResult]=useState(null);
 const load=async()=>{try{const params=new URLSearchParams(location.search);const checkout=params.get('checkout_id')||(!params.get('order_id')?sessionStorage.getItem('vellor-last-checkout-id'):null);
  const order=params.get('order_id');if(!checkout&&!order)throw Error('Nenhuma tentativa de pagamento selecionada.');
  const query=checkout?'checkout_id='+encodeURIComponent(checkout):'order_id='+encodeURIComponent(order);
  trace('checkout.groups.opened',{phase:'refresh'});const r=await fetch('/api/asaas/groups?'+query,{cache:'no-store',headers:{'X-Vellor-Trace-ID':window.VellorTrace?.id||''}});const j=await r.json();if(!r.ok)throw Error(j.error);setData(j);setError('');traceOk('checkout.groups.loaded',{group_count:j.groups.length});
  if(j.groups.length&&j.groups.every(g=>g.payment_status==='approved')){
   const saved=sessionStorage.getItem('vellor-last-checkout-cart');const current=localStorage.getItem('goston-cart-preview');
   if(saved&&saved===current)localStorage.removeItem('goston-cart-preview');
  }
 }catch(e){traceError('checkout.groups.failed','GROUP_QUERY_FAILED',e.message);setError(e.message)}};
 useEffect(()=>{load();const id=setInterval(load,20000);return()=>clearInterval(id)},[]);
 async function checkProvider(id){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/asaas/recheck-payment',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({checkout_id:data?.checkout_id,trace_id:window.VellorTrace?.id||null})
   });
   const x=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(x.error||'Nao foi possivel consultar o Asaas.');
   setProviderResult({group_id:id,...x});
   traceOk('payment.status',{status:x.provider_status||x.result||'checked'});
   await load();
  }catch(e){traceError('payment.failed','PAYMENT_RECHECK_FAILED',e.message);setError(e.message)}
  finally{setBusy(false)}
 }
 async function retry(id){try{setBusy(true);const r=await fetch('/api/asaas/retry-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checkout_id:data?.checkout_id,trace_id:window.VellorTrace?.id||null})});const j=await r.json();if(!r.ok)throw Error(j.error);if(!j.checkout_url?.startsWith('https://'))throw Error('Link inválido.');trace('payment.redirect',{checkout_mode:'standard'});window.location.assign(j.checkout_url)}catch(e){traceError('payment.failed','RETRY_PREFERENCE_FAILED',e.message);setError(e.message);setBusy(false)}}
 return <main className="page checkoutbox"><Link href="/"><img width="180" src="/logo-vellor.png" alt="VELLOR"/></Link><h1>Acompanhe seus pagamentos</h1>
 <p>O checkout reúne os fornecedores em uma única cobrança Asaas. <b>Cada pedido é confirmado somente após a aprovação do pagamento correspondente.</b> As demais etapas podem continuar pendentes.</p>
 {error&&<p className="notice error" role="alert">{error} · Rastreamento: <code>{window.VellorTrace?.id||'indisponivel'}</code></p>}
 {!data?<p>Consultando pagamentos...</p>:<section className="card"><h2>Acompanhamento do checkout</h2>
 {data.groups.map((g,index)=><div className="card" key={g.id}><div className="flexrow"><b>Pagamento {index+1}</b><span className="spacer"/><strong>{money(g.amount_cents)}</strong></div>
 <p>Status: <b>{labels[g.payment_status]||g.payment_status}</b>{g.order_number&&<> · Pedido #{g.order_number}</>}</p>
 {g.payment_status==='pending'&&<div style={{marginBottom:12}}>
   <button className="btn ghost" disabled={busy} type="button" onClick={()=>checkProvider(g.id)}>VERIFICAR STATUS NO ASAAS</button>
   <p className="small">Consulta a API do provedor e verifica pagamentos sem depender de webhook. Nao gera nova cobranca.</p>
  </div>}
 {providerResult?.group_id===g.id&&<p className="notice" role="status">Retorno do provedor: <b>{providerResult.result||'NAO_DETERMINADO'}</b>
  {providerResult.provider_status&&<> · status: {providerResult.provider_status}</>}
  {providerResult.status_detail&&<> · detalhe: {providerResult.status_detail}</>}
  {providerResult.reason&&<> · {providerResult.reason}</>}
 </p>}
 {g.payment_status==='pending'&&(!g.checkout_expires_at||new Date(g.checkout_expires_at)>new Date())&&(g.checkout_url?<a className="btn gold" href={g.checkout_url} onClick={()=>trace('payment.redirect',{checkout_mode:'standard'})}>CONTINUAR PAGAMENTO</a>:<button className="btn gold" disabled={busy} onClick={()=>retry(g.id)}>GERAR LINK DE PAGAMENTO</button>)}
 {g.payment_status==='pending'&&g.checkout_expires_at&&new Date(g.checkout_expires_at)<=new Date()&&<p className="notice error">Este checkout expirou. Volte ao carrinho e gere novos pagamentos.</p>}
 {g.payment_status==='pending'&&g.checkout_expires_at&&<p className="small">Link válido até {new Date(g.checkout_expires_at).toLocaleString('pt-BR')}.</p>}
 {g.payment_status==='refund_pending'&&<p className="notice error">Pagamento recebido, mas há uma pendência que exige verificação administrativa. Não será enviado antes de ser resolvido.</p>}
 {g.tracking_code&&<p className="small">Rastreio: {g.carrier} — {g.tracking_code}</p>}</div>)}
 <button className="btn ghost" onClick={load}>ATUALIZAR SITUAÇÃO</button>
 <p className="help">A página de retorno não confirma pagamentos. Somente o servidor valida o pagamento com o Asaas e cria o pedido após aprovação.</p></section>}
 <p><Link href="/conta">Consultar meus pedidos pagos</Link></p></main>
}
