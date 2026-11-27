'use client';
import {useEffect,useState} from 'react';import Frame from '@/components/Frame';
export default function SupplierRegister(){
 const [token,setToken]=useState(''),[invite,setInvite]=useState(null),[form,setForm]=useState({name:'',email:'',business_name:'',document:'',phone:'',address:'',password:'',pix_type:'',pix_key:'',pix_holder_name:''}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const t=new URLSearchParams(window.location.search).get('token')||'';setToken(t);fetch('/api/suppliers/invite-check?token='+encodeURIComponent(t)).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);setInvite(j.invite);if(j.invite.email)setForm(v=>({...v,email:j.invite.email}))}).catch(e=>setMessage(e.message))},[]);
 async function submit(e){e.preventDefault();try{setBusy(true);setMessage('');const r=await fetch('/api/supplier-invite/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,token})});const j=await r.json();if(!r.ok)throw Error(j.error);window.location.assign('/fornecedor')}catch(e){setMessage(e.message);setBusy(false)}}
 return <Frame><main className="page checkoutbox"><h1>Cadastro de fornecedor</h1><p>Área de parceiros da VELLOR WEAR. O cadastro é permitido somente por convite.</p>{message&&<div className="notice error" role="alert">{message}</div>}{invite&&<section className="card"><h2>Seu convite</h2><p className="small">Convite exclusivo, válido até {new Date(invite.expires_at).toLocaleDateString('pt-BR')}. Informe seus dados para cadastrar sua conta de fornecedor.</p><p className="small">Ao continuar, você aceita as condições comerciais de fornecedores que deverão ser formalizadas com a VELLOR.</p><form onSubmit={submit}><div className="formgrid">{[['name','Nome completo'],['email','E-mail para sua conta'],['business_name','Empresa / nome comercial'],['document','CPF ou CNPJ'],['phone','Telefone'],['address','Endereço comercial'],['password','Senha com 12 caracteres ou mais']].map(([key,label])=><div className="field" key={key}><label>{label}</label><input type={key==='password'?'password':key==='email'?'email':'text'} autoComplete={key==='email'?'email':undefined} readOnly={key==='email'&&Boolean(invite.email)} required={key!=='phone'&&key!=='address'} minLength={key==='password'?12:undefined} placeholder={key==='address'?'Rua, número, bairro, Cidade/UF':undefined} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/></div>)}</div>
  <fieldset className="card" style={{border:'1px solid #d6ded5',margin:'22px 0',padding:20}}>
   <legend style={{padding:'0 8px',fontWeight:700}}>Dados para receber os repasses Pix</legend>
   <p className="help">A VELLOR fará o pagamento ao fornecedor por Pix, manualmente, após a confirmação da venda. Cadastre uma chave que já esteja registrada no seu banco. Antes de enviar o Pix, a VELLOR verificará o beneficiário.</p>
   <div className="formgrid">
    <div className="field"><label htmlFor="pix-type">Tipo de chave Pix *</label>
     <select id="pix-type" required value={form.pix_type} onChange={e=>setForm(v=>({...v,pix_type:e.target.value,pix_key:''}))}>
      <option value="">Selecione o tipo</option>
      <option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option>
      <option value="phone">Celular</option><option value="random">Chave aleatória</option>
     </select></div>
    <div className="field"><label htmlFor="pix-key">Sua chave Pix *</label>
     <input id="pix-key" required maxLength={255} autoComplete="off" spellCheck={false} value={form.pix_key}
      placeholder={form.pix_type==='phone'?'+55 (21) 99999-9999':form.pix_type==='email'?'email@exemplo.com':form.pix_type==='random'?'Cole sua chave aleatória':'Informe a chave Pix'}
      onChange={e=>setForm(v=>({...v,pix_key:e.target.value}))}/></div>
    <div className="field"><label htmlFor="pix-holder">Nome completo ou razão social do titular da conta Pix *</label>
     <input id="pix-holder" required maxLength={120} minLength={3} autoComplete="name" value={form.pix_holder_name}
      onChange={e=>setForm(v=>({...v,pix_holder_name:e.target.value}))}/></div>
    
   </div>
   <p className="small">Os dados Pix são restritos à operação de pagamentos. Não disponibilizamos essas informações aos clientes.</p>
  </fieldset>
  <button className="btn gold" disabled={busy}>{busy?'CADASTRANDO...':'CRIAR CONTA DE FORNECEDOR'}</button></form></section>}</main></Frame>
}
