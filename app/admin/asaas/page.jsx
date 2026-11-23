'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Frame from '@/components/Frame';
export default function AsaasAdmin(){
 const [me,setMe]=useState(null),[status,setStatus]=useState(null),[error,setError]=useState(''),
  [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[wallet,setWallet]=useState(''),[checkout,setCheckout]=useState(null);
 async function load(){try{const [auth,res]=await Promise.all([fetch('/api/auth/me',{cache:'no-store'}),fetch('/api/admin/asaas',{cache:'no-store'})]);const a=await auth.json(),r=await res.json();if(!res.ok)throw Error(r.error||'Sem permissao');setMe(a.user);setStatus(r)}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[]);
 async function action(type){setBusy(true);setError('');setMessage('');
 try{
  const r=await fetch('/api/admin/asaas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:type,supplier_id:selected,wallet_id:wallet.trim()})});
  const j=await r.json();if(!r.ok)throw Error(j.error||'Operacao nao autorizada');
  if(type==='test_split')setCheckout(j);else{setMessage('Carteira do fornecedor registrada.');await load()}
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 return <Frame user={me}><main className="page checkoutbox">
 <p><Link href="/admin">Voltar à administração</Link></p><h1>Asaas · Sandbox da VELLOR</h1>
 <section className="card"><h2>Conexão com o Asaas</h2>
 <p>Ambiente: <b>Sandbox</b> — pagamentos reais não habilitados.</p>
 {!status?<p>Verificando...</p>:<><p>Variáveis: <b>{status.configured?'Configuradas':'Incompletas'}</b> · Autenticação API: <b>{status.connection?.authenticated?'Validada':'Não validada'}</b></p>
 <p>Carteira principal: <b>{status.connection?.primary_wallet_available?'Identificada':'Não disponível'}</b> · Estrutura Neon: <b>{status.schema_ready?'Pronta':'Migração pendente'}</b></p>
 <p>Webhook de pagamentos: <b>{status.webhook_token_set?'Token configurado':'Pendente'}</b> · Checkout comercial: <b>{status.checkout_enabled?'Habilitado para conta de teste':'Bloqueado'}</b></p></>}
 {status?.connection_error&&<p className="notice error">Diagnóstico da API: {status.connection_error}</p>}
 <button className="btn ghost" onClick={load}>ATUALIZAR VERIFICAÇÃO</button></section>
 <section className="card"><h2>Vincular carteira Asaas do fornecedor</h2>
 <p>Cada fornecedor precisa de uma conta Asaas Sandbox própria. O administrador deve confirmar a titularidade antes de registrar o <code>walletId</code>. Nunca utilize a carteira principal da VELLOR como destinatária do Split.</p>
 <div className="field"><label>Fornecedor</label><select value={selected} onChange={e=>{setSelected(e.target.value);const s=status?.suppliers?.find(s=>s.id===e.target.value);setWallet(s?.wallet_id||'')}}><option value="">Selecione...</option>{(status?.suppliers||[]).map(s=><option value={s.id} key={s.id}>{s.business_name} {s.wallet_id?'(carteira cadastrada)':''}</option>)}</select></div>
 <div className="field"><label>walletId da conta Asaas do fornecedor</label><input value={wallet} onChange={e=>setWallet(e.target.value)} placeholder="UUID da carteira do fornecedor" autoComplete="off"/></div>
 <button className="btn" disabled={busy||!selected||!status?.schema_ready} onClick={()=>action('save_wallet')}>SALVAR CARTEIRA</button>
 </section>
 <section className="card"><h2>Experimento isolado: R$ 170</h2><p>VELLOR recebe R$ 70 menos taxas; fornecedor recebe R$ 100. Este teste não cria pedido VELLOR, nem marca pagamento como aprovado.</p>
 <button className="btn gold" disabled={busy||!selected||!status?.configured||!status?.schema_ready} onClick={()=>action('test_split')}>GERAR CHECKOUT ASAAS DE TESTE</button>
 {checkout&&<div className="notice"><p>Checkout de teste criado. ID: <code>{checkout.checkout_id}</code></p><a className="btn gold" href={checkout.checkout_url} target="_blank" rel="noopener noreferrer">ABRIR PAGAMENTO ASAAS</a><p>Após concluir, verificar a confirmação na API/Webhook. O retorno da página não prova aprovação.</p></div>}
 </section>
 {message&&<p className="notice" role="status">{message}</p>}{error&&<p role="alert" className="notice error">{error}</p>}
 </main></Frame>
}