'use client';
import {useEffect,useState} from 'react';import Frame from '@/components/Frame';
const brl=n=>Number((n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const trace=(stage,meta)=>{if(typeof window!=='undefined')window.VellorTrace?.event(stage,meta||{})};
const traceOk=(stage,meta)=>{if(typeof window!=='undefined')window.VellorTrace?.success(stage,meta||{})};
const traceError=(stage,code,message,meta)=>{if(typeof window!=='undefined')window.VellorTrace?.error(stage,code,message,meta||{})};
const traceId=()=>typeof window!=='undefined'?window.VellorTrace?.id||null:null;
async function api(path,body){const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const x=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(x.error||'Falha ao preparar a compra.');e.code=x.code||null;e.status=r.status;throw e;}return x}
export default function Checkout(){const [user,setUser]=useState(null),[ordersOpen,setOrdersOpen]=useState(false),[loading,setLoading]=useState(true),[cart,setCart]=useState([]),[coupon,setCoupon]=useState(''),[quote,setQuote]=useState(null),[addresses,setAddresses]=useState([]),[address,setAddress]=useState(''),[message,setMessage]=useState(''),[errorCode,setErrorCode]=useState(''),[sending,setSending]=useState(false);
 useEffect(()=>{
  trace('checkout.opened',{phase:'page_initialized'});let cancelled=false,sessionVerified=false;
  try{const saved=JSON.parse(localStorage.getItem('goston-cart-preview')||'[]');setCart(Array.isArray(saved)?saved:[]);setCoupon(sessionStorage.getItem('pg-goston-cupom')||'')}catch{}
  async function init(){
   try{
    const authResponse=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    if(!authResponse.ok){window.location.replace('/conta?next=%2Ffinalizar');return;}
    const session=await authResponse.json();
    if(cancelled)return;
    if(!session.user){window.location.replace('/conta?next=%2Ffinalizar');return;}
    sessionVerified=true;setUser(session.user);traceOk('checkout.auth',{status:'authenticated',session_role:session.user.role});
    const [addressResponse,statusResponse]=await Promise.all([fetch('/api/account/addresses',{cache:'no-store'}),fetch('/api/store/status',{cache:'no-store'})]);
    if(!addressResponse.ok||!statusResponse.ok)throw new Error('Não foi possível carregar os dados do checkout.');
    const [addressesData,statusData]=await Promise.all([addressResponse.json(),statusResponse.json()]);
    if(cancelled)return;
    const list=addressesData.addresses||[];
    setOrdersOpen(Boolean(statusData.orders_open));setAddresses(list);
    setAddress(list.find(x=>x.is_default)?.id||list[0]?.id||'');traceOk('checkout.address',{status:list.length?'available':'missing'});
   }catch(e){if(!cancelled){if(!sessionVerified){window.location.replace('/conta?next=%2Ffinalizar');return;}traceError('checkout.address','CHECKOUT_INITIALIZATION_FAILED',e.message);setMessage(e.message||'Erro ao consultar os dados do checkout.');}}
   finally{if(!cancelled)setLoading(false)}
  }
  init();
  return()=>{cancelled=true};
 },[]);
 useEffect(()=>{if(!cart.length)return;setQuote(null);trace('checkout.quote.started',{item_count:cart.length});api('checkout/quote',{items:cart,coupon,trace_id:traceId()}).then(x=>{setQuote(x.quote);setMessage('');traceOk('checkout.quote.success',{amount_cents:x.quote?.total_cents})}).catch(e=>{traceError('checkout.quote.failed',e.code||'QUOTE_FAILED',e.message,{status:e.status});setMessage(e.message)})},[cart,coupon]);
 async function finalize(){try{setSending(true);setMessage('');setErrorCode('');trace('checkout.create.started',{item_count:cart.length});const r=await api('asaas/checkout-create',{items:cart,coupon,address_id:address,trace_id:traceId()});
  if(!r.checkout_id||!Array.isArray(r.groups))throw new Error('Não foi possível abrir os pagamentos.');
  traceOk('checkout.create.success',{group_count:r.groups.length});sessionStorage.setItem('vellor-last-checkout-id',r.checkout_id);
  // A compra NÃO foi concluída ainda: o carrinho é preservado até a confirmação de TODOS os pagamentos.
  sessionStorage.setItem('vellor-last-checkout-cart',localStorage.getItem('goston-cart-preview')||'[]');
  window.location.href='/pagamento/grupos?checkout_id='+encodeURIComponent(r.checkout_id)
 }catch(e){traceError('checkout.create.failed',e.code||'CHECKOUT_CREATE_FAILED',e.message,{status:e.status});setMessage(e.message);setErrorCode(e.code||'');setSending(false)}}
 const ready=ordersOpen&&user?.role==='customer'&&quote&&quote.total_cents!==null&&address&&cart.length>0&&!sending;
 return <Frame user={user}><main className="page checkoutbox"><h1>Finalizar pedido · Vellor Menswear</h1>{!loading&&user&&!ordersOpen&&<div className="notice"><b>Finalização temporariamente indisponível.</b> Estamos configurando os meios de pagamento. Você pode conferir produtos e manter seu carrinho.</div>}{message&&<p role="alert" className="notice error">{message}{errorCode&&<span className="small"> · Código: {errorCode}</span>} · Rastreamento: <code>{traceId()||'indisponivel'}</code></p>}
 {loading?<p>Carregando...</p>:!user?<section className="card"><h2>Identifique-se</h2><p>Entre ou crie sua conta para salvar o pedido e receber atualizações.</p><a className="btn gold" href="/conta?next=%2Ffinalizar">ENTRAR / CADASTRAR</a></section>:user.role!=='customer'?<p className="notice">Use uma conta do tipo Cliente para realizar o checkout.</p>:<><section className="card"><h2>Endereço de entrega</h2>{addresses.length?<><div className="field"><label>Escolha seu endereço</label><select value={address} onChange={e=>{setAddress(e.target.value);trace('checkout.address',{status:'selected'})}}>{addresses.map(a=><option key={a.id} value={a.id}>{a.label||'Endereço'} — {a.street}, {a.number} — {a.city}/{a.state}</option>)}</select></div><p className="small">O endereço selecionado será registrado na tentativa de pagamento e no pedido somente após a aprovação.</p></>:<p>Você ainda não tem endereço cadastrado. <a href="/conta">Cadastrar endereço</a>.</p>}</section>
 <section className="card"><h2>Resumo dos itens</h2>{quote?.items?.map((i,n)=><div className="rowitems" key={n}><span>{i.name} — {i.variant}<br/><small>{i.size||'Sem tamanho'} · {i.qty} un. · {i.sku}</small></span><b>{brl(i.line_cents)}</b></div>)||<p>Carregando preços oficiais...</p>}<div className="field"><label>Cupom de desconto</label><div className="flexrow"><input className="form" style={{maxWidth:260}} placeholder="Código do cupom" value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())}/></div></div><p>Subtotal: {brl(quote?.subtotal_cents)}<br/>Desconto: {brl(quote?.discount_cents)}<br/>Frete: incluído no preço<br/><b>Total: {quote?.total_cents===null?'A confirmar':brl(quote?.total_cents)}</b></p><p className="help">Preços e descontos são validados no servidor. A VELLOR recebe um único pagamento pelo Asaas e distribui os valores aos fornecedores. Nenhum pedido é confirmado antes de verificar a aprovação oficial; cada fornecedor prepara sua parte separadamente.</p><button className="btn gold" disabled={!ready} onClick={finalize}>{sending?'PREPARANDO CHECKOUT...':'CONTINUAR PARA PAGAMENTO'}</button>{!ready&&<p className="small">Para continuar, entre com uma conta Cliente, cadastre um endereço e aguarde a liberação da finalização de pedidos.</p>}</section></>}</main></Frame>
}
