'use client';
import {useEffect,useState} from 'react';import Link from 'next/link';
const money=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const trace=(stage,meta)=>window.VellorTrace?.event(stage,meta||{});
const traceOk=(stage,meta)=>window.VellorTrace?.success(stage,meta||{});
const traceError=(stage,code,message,meta)=>window.VellorTrace?.error(stage,code,message,meta||{});
const labels={pending:'Aguardando pagamento',approved:'Pago e confirmado',refunded:'Reembolsado',refund_pending:'Reembolso em análise',rejected:'Não aprovado',refund_failed:'Falha no reembolso'};
export default function GroupCheckout(){const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{try{const params=new URLSearchParams(location.search);const checkout=params.get('checkout_id')||(!params.get('order_id')?sessionStorage.getItem('vellor-last-checkout-id'):null);
  const order=params.get('order_id');if(!checkout&&!order)throw Error('Nenhuma tentativa de pagamento selecionada.');
  const query=checkout?'checkout_id='+encodeURIComponent(checkout):'order_id='+encodeURIComponent(order);
  trace('checkout.groups.opened',{phase:'refresh'});const r=await fetch('/api/marketplace/groups?'+query,{cache:'no-store',headers:{'X-Vellor-Trace-ID':window.VellorTrace?.id||''}});const j=await r.json();if(!r.ok)throw Error(j.error);setData(j);setError('');traceOk('checkout.groups.loaded',{group_count:j.groups.length});
  if(j.groups.length&&j.groups.every(g=>g.payment_status==='approved')){
   const saved=sessionStorage.getItem('vellor-last-checkout-cart');const current=localStorage.getItem('goston-cart-preview');
   if(saved&&saved===current)localStorage.removeItem('goston-cart-preview');
  }
 }catch(e){traceError('checkout.groups.failed','GROUP_QUERY_FAILED',e.message);setError(e.message)}};
 useEffect(()=>{load();const id=setInterval(load,20000);return()=>clearInterval(id)},[]);
 async function testSandbox(id){try{
  setBusy(true);setError('');
  const r=await fetch('/api/marketplace/sandbox-link-test',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({group_id:id,trace_id:window.VellorTrace?.id||null})
  });
  const j=await r.json();if(!r.ok)throw Error(j.error||'Falha ao obter checkout sandbox.');
  if(!j.experimental||!j.sandbox_checkout_url?.startsWith('https://sandbox.mercadopago.com'))throw Error('Link sandbox invalido.');
  trace('payment.redirect',{checkout_mode:'sandbox',host:'sandbox.mercadopago.com.br'});window.location.assign(j.sandbox_checkout_url);
 }catch(e){traceError('payment.failed','SANDBOX_LINK_FAILED',e.message);setError(e.message);setBusy(false)}}
 async function retry(id){try{setBusy(true);const r=await fetch('/api/marketplace/retry-preference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group_id:id})});const j=await r.json();if(!r.ok)throw Error(j.error);if(!j.checkout_url?.startsWith('https://'))throw Error('Link inválido.');trace('payment.redirect',{checkout_mode:'standard'});window.location.assign(j.checkout_url)}catch(e){traceError('payment.failed','RETRY_PREFERENCE_FAILED',e.message);setError(e.message);setBusy(false)}}
 return <main className="page checkoutbox"><Link href="/"><img width="180" src="/logo-vellor.png" alt="VELLOR"/></Link><h1>Acompanhe seus pagamentos</h1>
 <p>Alguns itens podem gerar pagamentos separados. <b>Cada pedido é confirmado somente após a aprovação do pagamento correspondente.</b> As demais etapas podem continuar pendentes.</p>
 {error&&<p className="notice error" role="alert">{error} · Rastreamento: <code>{window.VellorTrace?.id||'indisponivel'}</code></p>}
 {!data?<p>Consultando pagamentos...</p>:<section className="card"><h2>Acompanhamento do checkout</h2>
 {data.groups.map((g,index)=><div className="card" key={g.id}><div className="flexrow"><b>Pagamento {index+1}</b><span className="spacer"/><strong>{money(g.amount_cents)}</strong></div>
 <p>Status: <b>{labels[g.payment_status]||g.payment_status}</b>{g.order_number&&<> · Pedido #{g.order_number}</>}</p>
 {g.payment_status==='pending'&&(!g.checkout_expires_at||new Date(g.checkout_expires_at)>new Date())&&(g.checkout_url?<a className="btn gold" href={g.checkout_url} onClick={()=>trace('payment.redirect',{checkout_mode:'standard'})}>CONTINUAR PAGAMENTO</a>:<button className="btn gold" disabled={busy} onClick={()=>retry(g.id)}>GERAR LINK DE PAGAMENTO</button>)}
 {data.sandbox_link_test_enabled&&g.payment_status==='pending'&&g.checkout_url&&(!g.checkout_expires_at||new Date(g.checkout_expires_at)>new Date())&&
  <div><button className="btn ghost" disabled={busy} onClick={()=>testSandbox(g.id)}>TESTAR LINK SANDBOX (ALTERNATIVO)</button>
   <p className="small">Experimento somente com conta compradora de teste. O checkout principal permanece inalterado.</p></div>}
 {g.payment_status==='pending'&&g.checkout_expires_at&&new Date(g.checkout_expires_at)<=new Date()&&<p className="notice error">Este checkout expirou. Volte ao carrinho e gere novos pagamentos.</p>}
 {g.payment_status==='pending'&&g.checkout_expires_at&&<p className="small">Link válido até {new Date(g.checkout_expires_at).toLocaleString('pt-BR')}.</p>}
 {g.payment_status==='refund_pending'&&<p className="notice error">Pagamento recebido, mas há uma pendência que exige verificação administrativa. Não será enviado antes de ser resolvido.</p>}
 {g.tracking_code&&<p className="small">Rastreio: {g.carrier} — {g.tracking_code}</p>}</div>)}
 <button className="btn ghost" onClick={load}>ATUALIZAR SITUAÇÃO</button>
 <p className="help">A página de retorno não confirma pagamentos. Somente o servidor valida o pagamento com o Mercado Pago e cria o pedido após aprovação.</p></section>}
 <p><Link href="/conta">Consultar meus pedidos pagos</Link></p></main>
}
