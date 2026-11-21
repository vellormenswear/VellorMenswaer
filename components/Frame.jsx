'use client';
import {useState} from 'react';
import Link from 'next/link';
import {logoutAndRedirect} from '@/lib/logout-client.mjs';

export default function Frame({children,user,logout}){
 const [signingOut,setSigningOut]=useState(false);
 const [logoutError,setLogoutError]=useState('');
 async function handleSignOut(){
  if(signingOut)return;
  setSigningOut(true);
  setLogoutError('');
  try{
   if(typeof logout==='function')await logout();
   else await logoutAndRedirect(fetch,url=>window.location.replace(url));
  }catch(e){setLogoutError(e?.message||'Não foi possível encerrar a sessão.');}
  finally{setSigningOut(false)}
 }
 return <><header className="brandbar"><Link href="/"><img src="/logo-vellor.png" alt="Vellor Menswear"/></Link><nav><Link href="/">VITRINE</Link><Link href="/conta">MINHA CONTA</Link>{user?.role==='supplier'&&<Link href="/fornecedor">FORNECEDOR</Link>}{['employee','admin','super_admin'].includes(user?.role)&&<Link href="/admin">ADMINISTRAÇÃO</Link>}{user&&<button type="button" disabled={signingOut} onClick={handleSignOut}>{signingOut?'SAINDO...':'SAIR'}</button>}</nav></header>{logoutError&&<p className="notice" role="alert">{logoutError}</p>}{children}</>;
}
