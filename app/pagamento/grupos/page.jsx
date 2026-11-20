'use client';
import {useEffect,useState} from 'react';import Link from 'next/link';
const money=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const labels={pending:'Aguardando pagamento',approved:'Pago e confirmado',refunded:'Reembolsado',refund_pending:'Reembolso em análise',rejected:'Não aprovado',refund_failed:'Falha no reembolso'};
export default function GroupCheckout(){const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{try{const params=new URLSearchParams(location.search);const checkout=params.get('checkout_id')||(!params.get('order_id')?sessionStorage.getItem('vellor-last-checkout-id'):null);
  const order=params.get('order_id');if(!checkout&&!order)throw Error('Nenhuma tentativa de pagamento selecionada.');
  const query=checkout?'checkout_id='+encodeURIComponent(checkout):'order_id='+encodeURIComponent(order);
  const r=await fetch('/api/marketplace/groups?'+query,{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error);setData(j);setError('');
  if(j.groups.length&&j.groups.every(g=>g.payment_status==='approved')){
   const saved=sessionStorage.getItem('vellor-last-checkout-cart');const current=localStorage.getItem('goston-cart-preview');
   if(saved&&saved===current)localStorage.removeItem('goston-cart-preview');
  }
 }catch(e){setError(e.message)}};
 useEffect(()=>{load();const id=setInterval(load,20000);return()=>clearInterval(id)},[]);
 async function retry(id){try{setBusy(true);const r=await fetch('/api/marketplace/retry-preference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group_id:id})});const j=await r.json();if(!r.ok)throw Error(j.error);if(!j.checkout_url?.startsWith('https://'))throw Error('Link inválido.');window.location.assign(j.checkout_url)}catch(e){setError(e.message);setBusy(false)}}
 return <main className="page checkoutbox"><Link href="/"><img width="180" src="/logo-vellor.png" alt="VELLOR"/></Link><h1>Pagamentos por fornecedor</h1>
 <p>Os valores são cobrados separadamente. <b>O pedido de cada fornecedor só é criado depois da aprovação do respectivo pagamento.</b> Os outros pagamentos podem continuar pendentes.</p>
 {error&&<p className="notice error" role="alert">{error}</p>}
 {!data?<p>Consultando pagamentos...</p>:<section className="card"><h2>Acompanhamento do checkout</h2>
 {data.groups.map(g=><div className="card" key={g.id}><div className="flexrow"><b>{g.business_name}</b><span className="spacer"/><strong>{money(g.amount_cents)}</strong></div>
 <p>Status: <b>{labels[g.payment_status]||g.payment_status}</b>{g.order_number&&<> · Pedido #{g.order_number}</>}</p>
 {g.payment_status==='pending'&&(!g.checkout_expires_at||new Date(g.checkout_expires_at)>new Date())&&(g.checkout_url?<a className="btn gold" href={g.checkout_url}>PAGAR ESTE FORNECEDOR</a>:<button className="btn gold" disabled={busy} onClick={()=>retry(g.id)}>GERAR LINK DE PAGAMENTO</button>)}
 {g.payment_status==='pending'&&g.checkout_expires_at&&new Date(g.checkout_expires_at)<=new Date()&&<p className="notice error">Este checkout expirou. Volte ao carrinho e gere novos pagamentos.</p>}
 {g.payment_status==='pending'&&g.checkout_expires_at&&<p className="small">Link válido até {new Date(g.checkout_expires_at).toLocaleString('pt-BR')}.</p>}
 {g.payment_status==='refund_pending'&&<p className="notice error">Pagamento recebido, mas há uma pendência que exige verificação administrativa. Não será enviado antes de ser resolvido.</p>}
 {g.tracking_code&&<p className="small">Rastreio: {g.carrier} — {g.tracking_code}</p>}</div>)}
 <button className="btn ghost" onClick={load}>ATUALIZAR SITUAÇÃO</button>
 <p className="help">A página de retorno não confirma pagamentos. Somente o servidor valida o pagamento com o Mercado Pago e cria o pedido após aprovação.</p></section>}
 <p><Link href="/conta">Consultar meus pedidos pagos</Link></p></main>
}
