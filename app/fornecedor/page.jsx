'use client';
import {useEffect,useState,useRef} from 'react';import Frame from '@/components/Frame';
import {customerPaymentLabel} from '@/lib/customer-order-status.mjs';
import {variantAvailable} from '@/lib/stock-availability.mjs';
import SupplierListings from '@/components/SupplierListings';
const brl=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const req=async(method,path,data)=>{const r=await fetch('/api/'+path,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok){const e=Error(j.error||'Falha na operação');e.status=r.status;throw e;}return j};
function InventoryForm({v,busy,post}){
 const current=()=>variantAvailable(v);
 const [draft,setDraft]=useState(current),dirty=useRef(false);
 useEffect(()=>{if(!dirty.current){setDraft(current())}},[v.stock_mode,v.stock,v.supplier_available]);
 return <form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(await post('inventory',{variant_id:v.variant_id,stock_mode:'availability',available:f.get('available')==='true'}))dirty.current=false;}} className="flexrow"><label>Disponibilidade <select name="available" value={String(draft)} onChange={e=>{dirty.current=true;setDraft(e.target.value==='true')}}><option value="true">Disponível</option><option value="false">Indisponível</option></select></label><button className="tiny" disabled={busy}>ATUALIZAR DISPONIBILIDADE</button></form>;
}
export default function Supplier(){const [user,setUser]=useState(null),[data,setData]=useState(null),[msg,setMsg]=useState(''),[tab,setTab]=useState('products'),[selectedOrder,setSelectedOrder]=useState(null),[busy,setBusy]=useState(false),[categories,setCategories]=useState([]),[loading,setLoading]=useState(true),[pixForm,setPixForm]=useState({pix_type:'',pix_key:'',pix_holder_name:''}),[addressDraft,setAddressDraft]=useState('');
 const revision=useRef(''),loaded=useRef(false),inFlight=useRef(null),pixDirty=useRef(false),addressDirty=useRef(false);
 async function load({force=false,resetPix=false}={}){
  if(inFlight.current){if(!force)return inFlight.current;await inFlight.current;if(inFlight.current)return load({force,resetPix});}
  const work=(async()=>{try{
   const source=await req('GET','suppliers/dashboard?view=portal'+(!force&&revision.current?'&revision='+encodeURIComponent(revision.current):''));
   if(source.unchanged)return true;
   revision.current=source.revision;
   if(!loaded.current)setMsg('');
   setUser(source.user);setData(source);setCategories(source.categories||[]);
   if(!loaded.current||resetPix||!pixDirty.current){setPixForm({pix_type:source.pix_account?.pix_type||'',pix_key:'',pix_holder_name:source.pix_account?.pix_holder_name||''});pixDirty.current=false;}
   if(!loaded.current||!addressDirty.current)setAddressDraft(source.supplier.address_text||'');
   loaded.current=true;return true;
  }catch(e){
   if(e.status===401||e.status===403||!loaded.current){setData(null);setUser(null);loaded.current=false;revision.current='';setMsg(e.message);}
   else if(force)setMsg(e.message);
   return false;
  }finally{setLoading(false)}})();
  inFlight.current=work;
  try{return await work;}finally{if(inFlight.current===work)inFlight.current=null;}
 }
 useEffect(()=>{
  let stopped=false,timer,generation=0;
  const tick=async()=>{clearTimeout(timer);const current=++generation;if(stopped)return;if(document.visibilityState!=='hidden')await load();if(!stopped&&generation===current)timer=setTimeout(tick,3000);};
  const resume=()=>{if(document.visibilityState!=='hidden')tick();};
  tick();document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);
  return()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume)};
 },[]);
 async function markNoticeRead(id){try{setBusy(true);setMsg('');
   await req('POST','suppliers/notification-read',{notification_id:id});await load({force:true});
  }catch(e){setMsg(e.message)}finally{setBusy(false)}
 }
 async function post(action,payload){try{setBusy(true);setMsg('');await req('POST','suppliers/'+action,payload);if(await load({force:true}))setMsg('Operação registrada.');return true}catch(e){setMsg(e.message);return false}finally{setBusy(false)}}
 async function savePix(e){
  e.preventDefault();
  if(data?.pix_account?.registered&&pixForm.pix_key.trim()&&!window.confirm('Deseja substituir a chave Pix utilizada para seus próximos repasses?'))return;
  try{setBusy(true);setMsg('');
   await req('POST','suppliers/pix-account',pixForm);
   if(await load({force:true,resetPix:true}))setMsg('Dados Pix atualizados com sucesso.');
  }catch(err){setMsg(err.message)}finally{setBusy(false)}
 }
 useEffect(()=>{if(tab==='orders'&&selectedOrder)document.getElementById('supplier-order-'+selectedOrder)?.scrollIntoView({block:'start',behavior:'smooth'})},[tab,selectedOrder]);
 const paymentRows=(data?.orders||[]).filter(x=>x.payment_status==='approved');
 const notices=data?.notifications||[];
 const unreadNotices=notices.filter(n=>!n.read_at);
 const noticeSummary=n=>n.kind==='supplier_size_changed'?'A VELLOR alterou o tamanho do item '+n.payload?.sku+' de '+(n.payload?.old_size||'padrão')+' para '+n.payload?.new_size+'. Confira a disponibilidade e a nova numeração antes de postar.':n.kind==='supplier_paid'
  ?'A VELLOR registrou seu repasse de '+brl(n.supplier_amount_cents)+'. Você está autorizado a preparar e enviar este pedido.'
  :'O cliente confirmou o pagamento. Seu valor de fornecimento é '+brl(n.supplier_amount_cents)+'. Aguarde a VELLOR realizar e confirmar seu repasse antes de preparar ou enviar.';
 return <Frame user={user}><main className="page vll-supplier-app"><h1>Portal do fornecedor</h1><p>Seus produtos, pedidos e entregas na VELLOR WEAR</p>{msg&&<p className="notice" role="status">{msg}</p>}{!data?<section className="card"><p>{loading?'Carregando dados...':msg?'Não foi possível carregar os dados. Confira sua autorização e a configuração do banco Neon.':'Entre com a conta criada pelo convite para acessar o painel.'}</p><p><a href="/conta">Fazer login</a></p><button type="button" className="btn ghost" onClick={()=>load({force:true})}>TENTAR NOVAMENTE</button></section>:<><div className="cols3"><div className="metric"><strong>{data.products.length}</strong><small>Variações aprovadas</small></div><div className="metric"><strong>{paymentRows.length}</strong><small>Pedidos pagos</small></div><div className="metric"><strong>{brl(paymentRows.reduce((s,g)=>s+g.supplier_amount_cents,0))}</strong><small>Valores brutos de fornecimento</small></div></div><section className="card"><h2>{data.supplier.business_name}</h2>
  <form className="formgrid" onSubmit={async e=>{e.preventDefault();if(await post('address',{address:addressDraft}))addressDirty.current=false;}}><div className="field"><label htmlFor="supplier-address">Endereço comercial</label><input id="supplier-address" name="address" required maxLength={600} value={addressDraft} onChange={e=>{addressDirty.current=true;setAddressDraft(e.target.value)}} placeholder="Rua, número, bairro, Cidade/UF"/></div><button type="submit" className="tiny" disabled={busy}>SALVAR ENDEREÇO</button></form>
  <p className="help">Pagamentos recebidos pela VELLOR via InfinitePay. O Pix de cada pedido é transferido manualmente ao fornecedor, e a preparação só é liberada quando o administrador confirma o repasse.</p>
 </section>
 <section className="card" aria-label="Conta Pix para receber os repasses">
  <h2>Minha chave Pix para repasses</h2>
  {data.pix_account?.registered?<p className="notice ok">
   <b>Chave cadastrada</b> · {data.pix_account.pix_type.toUpperCase()} · {data.pix_account.pix_key_mask}<br/>
   <small>Titular: {data.pix_account.pix_holder_name}. A chave completa fica restrita ao setor de pagamentos da VELLOR.</small>
  </p>:<p className="notice error" role="status">Cadastre sua chave Pix para receber os pagamentos da VELLOR. Você poderá atualizar os dados neste painel.</p>}
  <form onSubmit={savePix} onChange={()=>{pixDirty.current=true}} className="formgrid">
   <div className="field"><label htmlFor="supplier-pix-type">Tipo de chave Pix</label><select id="supplier-pix-type" required value={pixForm.pix_type} onChange={e=>setPixForm(v=>({...v,pix_type:e.target.value,pix_key:''}))}>
    <option value="">Selecione o tipo</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="phone">Celular</option><option value="random">Chave aleatória</option>
   </select></div>
   <div className="field"><label htmlFor="supplier-pix-key">{data.pix_account?.registered?'Nova chave Pix':'Sua chave Pix'}</label><input id="supplier-pix-key" required={!data.pix_account?.registered||pixForm.pix_type!==data.pix_account?.pix_type} maxLength={255} autoComplete="off" spellCheck={false} value={pixForm.pix_key} placeholder="Informe a chave registrada no banco" onChange={e=>setPixForm(v=>({...v,pix_key:e.target.value}))}/></div>
   <div className="field"><label htmlFor="supplier-pix-holder">Nome ou razão social do titular da chave</label><input id="supplier-pix-holder" required minLength={3} maxLength={120} value={pixForm.pix_holder_name} onChange={e=>setPixForm(v=>({...v,pix_holder_name:e.target.value}))}/></div>
   
   <div className="field"><label>Confirmação</label><p className="help">Antes de realizar o pagamento, a VELLOR confere o destinatário no banco. Não envie informações de cartão aqui.</p></div>
   <button className="btn gold" disabled={busy}>{busy?'SALVANDO...':data.pix_account?.registered?'ATUALIZAR CHAVE PIX':'CADASTRAR CHAVE PIX'}</button>
  </form>
 </section>
 {unreadNotices.length>0&&<section className="supplier-notice-banner" role="status" aria-live="polite">
  <div><strong>{unreadNotices.length===1?'Você tem 1 novo aviso de pedido':`Você tem ${unreadNotices.length} novos avisos de pedidos`}</strong>
  <p>Confira os pagamentos e os repasses dos seus produtos.</p></div>
  <button type="button" className="btn ghost" onClick={()=>setTab('notifications')}>VER AVISOS</button>
 </section>}<nav className="navtabs">{[['products','Meus anúncios'],['notifications',`Avisos${unreadNotices.length?' ('+unreadNotices.length+')':''}`],['orders','Pedidos'],['finance','Recebimentos']].map(([key,label])=><button className={tab===key?'active':''} onClick={()=>setTab(key)} key={key}>{label}</button>)}</nav>
 {tab==='products'&&<><SupplierListings categories={categories} listings={data.listings} onChanged={()=>load({force:true})}/><section className="card"><h2>Disponibilidade dos produtos aprovados</h2>{data.products.map(v=><div className="card" key={v.variant_id}><b>{v.name} — {v.label} · {(v.sizes||[]).join(', ')}</b><p className="small">{v.product_code?v.product_code+' · ':''}SKU {v.sku} · Fornecimento: {brl(v.supplier_cost_cents)}</p><InventoryForm v={v} busy={busy} post={post}/></div>)}</section></>}
 {tab==='notifications'&&<section className="card supplier-notice-list">
  <div className="flexrow"><h2>Avisos de pedidos</h2><span className="spacer"/>
   <button type="button" className="btn ghost" onClick={()=>load({force:true})}>ATUALIZAR</button></div>
  <p className="help">Você recebe um aviso quando o cliente paga e outro quando a VELLOR registra o Pix do repasse. A conta do fornecedor só mostra avisos dos próprios produtos.</p>
  {notices.length===0?<p>Nenhum aviso de pagamento ainda.</p>:notices.map(n=><article className={'supplier-notice '+(!n.read_at?'is-unread':'')} key={n.id}>
    <div className="flexrow"><span className="supplier-notice-kind">{n.kind==='supplier_size_changed'?'TAMANHO ALTERADO':n.kind==='supplier_paid'?'REPASSE CONFIRMADO':'PAGAMENTO CONFIRMADO'}</span>
     {!n.read_at&&<span className="supplier-notice-new">NOVO</span>}
     <span className="spacer"/><time className="small" dateTime={n.created_at}>{new Date(n.created_at).toLocaleString('pt-BR')}</time></div>
    <h3>Pedido #{n.order_number}</h3><p>{noticeSummary(n)}</p>
    <div className="flexrow"><button type="button" className="tiny" onClick={()=>{setSelectedOrder(n.group_id);setTab('orders')}}>VER PEDIDO</button>
    {!n.read_at&&<button type="button" className="tiny" disabled={busy} onClick={()=>{if(n.kind!=='supplier_size_changed'||confirm('Conferiu o novo tamanho e a disponibilidade para envio?'))markNoticeRead(n.id)}}>{n.kind==='supplier_size_changed'?'CONFIRMAR NOVO TAMANHO':'MARCAR COMO LIDO'}</button>}</div>
   </article>)}
 </section>}
  {tab==='orders'&&<section className="card"><h2>Meus pedidos</h2>{data.orders.length===0?<p>Ainda não há pedidos.</p>:data.orders.map(o=><div className="card" id={'supplier-order-'+o.id} key={o.id}><div className="flexrow"><b>Pedido #{o.order_number}</b> · {customerPaymentLabel(o.payment_status)} · {({awaiting_payout:'Aguardando Pix da VELLOR',paid:'Repasse confirmado',preparing:'Em preparação',shipped:'Enviado',delivered:'Entregue',cancel_requested:'Cancelamento solicitado',canceled:'Cancelado'}[o.fulfillment_status]||'Em acompanhamento')} <span className="spacer"/><strong>{brl(o.supplier_amount_cents)}</strong></div>{o.items.map(i=><div className="rowitems" key={i.id}><div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>{i.image_url&&<img src={i.image_url} alt={i.name||'Produto'} width="64" height="64" loading="lazy" style={{objectFit:'contain',flexShrink:0}}/>}<div style={{minWidth:0,overflowWrap:'anywhere'}}><b>{i.name||i.product_code||i.sku}</b><div className="small">Variação / cor: {i.variant||'Padrão'} · Tamanho: {i.size||'Padrão'}</div><div className="small">Quantidade: {i.qty} · {i.product_code?i.product_code+' · ':''}{i.sku}</div></div></div></div>)}{notices.some(n=>n.group_id===o.id&&n.kind==='supplier_size_changed'&&!n.read_at)&&<p className="notice">Tamanho alterado. <button className="tiny" disabled={busy} onClick={()=>{const n=notices.find(n=>n.group_id===o.id&&n.kind==='supplier_size_changed'&&!n.read_at);if(n&&confirm('Conferiu o novo tamanho e a disponibilidade para envio?'))markNoticeRead(n.id)}}>Confirmar novo tamanho</button></p>}{o.payment_status==='approved'&&o.recipient_snapshot&&<p className="small">Destinatário: {o.recipient_snapshot.recipient}<br/>Endereço: {o.recipient_snapshot.street}, {o.recipient_snapshot.number}{o.recipient_snapshot.complement?' · '+o.recipient_snapshot.complement:''} — {o.recipient_snapshot.neighborhood}, {o.recipient_snapshot.city}/{o.recipient_snapshot.state} — CEP {o.recipient_snapshot.cep}</p>}{['paid','preparing'].includes(o.fulfillment_status)&&o.payment_status==='approved'&&<><div className="flexrow"><button className="tiny" onClick={()=>post('preparing',{group_id:o.id})}>EM PREPARAÇÃO</button><button className="tiny danger" onClick={()=>{const reason=prompt('Motivo do cancelamento (mínimo 8 caracteres):');if(reason)post('cancel',{group_id:o.id,reason})}}>CANCELAR / REEMBOLSAR</button></div><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);post('ship',{group_id:o.id,carrier:f.get('carrier'),tracking:f.get('tracking'),size_revision:o.size_revision})}} className="flexrow"><input className="form" required name="carrier" placeholder="Transportadora" style={{maxWidth:200}}/><input className="form" required name="tracking" placeholder="Código de rastreamento" style={{maxWidth:220}}/><button className="tiny">CONFIRMAR POSTAGEM</button></form></>}{o.payment_status==='approved'&&['paid','preparing','shipped','delivered'].includes(o.fulfillment_status)&&<div className="flexrow"><a className="tiny" href={'/api/shipping-label?group_id='+o.id+'&format=thermal'} target="_blank" rel="noopener">Etiqueta 100 × 150 mm</a><a className="tiny" href={'/api/shipping-label?group_id='+o.id+'&format=a4'} target="_blank" rel="noopener">Etiqueta A4</a></div>}{o.tracking_code&&<p className="small">Rastreio: {o.carrier||'Transportadora'} — {o.tracking_code}</p>}</div>)}</section>}
 {tab==='finance'&&<section className="card"><h2>Recebimentos</h2><p className="help">Valores de fornecimento pagos pelos clientes à VELLOR. O repasse é feito manualmente via Pix e deve ser confirmado pela administração. Consulte a aba Avisos.</p><div className="tablewrap"><table><thead><tr><th>Pedido</th><th>Fornecimento</th><th>Status de pagamento</th><th>Data</th></tr></thead><tbody>{data.orders.map(o=><tr key={o.id}><td>#{o.order_number}</td><td>{brl(o.supplier_amount_cents)}</td><td>{o.fulfillment_status==='awaiting_payout'?'Aguardando repasse Pix':['paid','preparing','shipped','delivered'].includes(o.fulfillment_status)&&o.payment_status==='approved'?'Repasse confirmado':customerPaymentLabel(o.payment_status)}</td><td>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table></div></section>}</>}</main></Frame>
}
