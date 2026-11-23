'use client';
import {useState} from 'react';
import Link from 'next/link';
import SupportWidget from '@/components/SupportWidget';
import StoreIdentity from '@/components/StoreIdentity';
import {logoutAndRedirect} from '@/lib/logout-client.mjs';

export default function Frame({children,user,logout}){
 const [signingOut,setSigningOut]=useState(false);
 const [logoutError,setLogoutError]=useState('');
 async function handleSignOut(){
  if(signingOut)return;
  setSigningOut(true);setLogoutError('');
  try{if(typeof logout==='function')await logout();
   else await logoutAndRedirect(fetch,url=>window.location.replace(url));
  }catch(e){setLogoutError(e?.message||'Não foi possível encerrar a sessão.')}
  finally{setSigningOut(false)}
 }
 const isAdmin=['employee','admin','super_admin'].includes(user?.role);
 const isSupplier=user?.role==='supplier';
 const showSupport=!isAdmin&&!isSupplier;
 return <>
  <header className="vll-site-header">
   <nav className="vll-header-left" aria-label="Ir à loja">
    <a href="/vitrine.html" className="vll-hd-link">EXPLORAR</a>
   </nav>
   <Link className="vll-brand" href="/" aria-label="VELLOR Menswear — página inicial">
    <img src="/logo-vellor.png" alt="VELLOR Menswear"/>
   </Link>
   <nav className="vll-header-right" aria-label="Acesso rápido">
    <a href="/vitrine.html#carrinho" className="vll-icon-link" title="Carrinho" aria-label="Meu carrinho">
     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 9h14l-1 12H6L5 9ZM9 10V7a3 3 0 0 1 6 0v3"/></svg>
    </a>
    <Link href="/conta" className="vll-icon-link" title="Minha conta" aria-label="Minha conta">
     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>
    </Link>
    {user&&<button className="vll-signout" type="button" disabled={signingOut} onClick={handleSignOut}>{signingOut?'SAINDO...':'SAIR'}</button>}
   </nav>
  </header>
  <div className="vll-brand-top" aria-hidden="true"/>
  <nav className="vll-category-nav" aria-label="Navegação da VELLOR">
   <a href="/vitrine.html">VITRINE</a>
   <a href="/vitrine.html#carrinho">MEU CARRINHO</a>
   <Link href="/conta">MINHA CONTA</Link>
   {isSupplier&&<Link href="/fornecedor">PORTAL DO FORNECEDOR</Link>}
   {isAdmin&&<Link href="/admin">ADMINISTRAÇÃO</Link>}
  </nav>
  {logoutError&&<p className="notice error" role="alert">{logoutError}</p>}
  <div className="vll-layout-content">{children}</div>
  <footer className="vll-app-footer" aria-label="Informações VELLOR">
   <div className="vll-footer-inner">
    <div className="vll-footer-top">
     <section className="vll-footer-brand">
      <strong>VELLOR</strong><span>MENSWEAR · ELEGÂNCIA MASCULINA</span>
      <p>Peças selecionadas para o seu estilo. Conte com nossa equipe para esclarecer dúvidas antes e depois da compra.</p>
     </section>
     <nav className="vll-footer-links" aria-label="Navegação do rodapé">
      <h2>Navegação</h2>
      <a href="/vitrine.html">Explorar produtos</a>
      <a href="/vitrine.html#carrinho">Meu carrinho</a>
      <Link href="/conta">Minha conta e pedidos</Link>
      {isSupplier&&<Link href="/fornecedor">Portal do fornecedor</Link>}
      {isAdmin&&<Link href="/admin">Administração</Link>}
     </nav>
     <section className="vll-footer-payments">
      <h2>Pagamento</h2>
      <div className="vll-payment-provider"><span>Pagamentos processados por</span><img src="https://upload.wikimedia.org/wikipedia/commons/0/0c/Logo_InfinitePay.svg" alt="InfinitePay" loading="lazy" decoding="async" referrerPolicy="no-referrer"/></div>
      <div className="vll-payment-methods vll-payment-brands" aria-label="Pix e bandeiras de cartão aceitas pela InfinitePay">
       <span className="vll-payment-mark vll-mark-pix"><img src="https://cdn.prod.website-files.com/65c1399ac999a342139b5069/65c1399ac999a342139b50c4_pix-color.svg" alt="Pix" loading="lazy" decoding="async" referrerPolicy="no-referrer"/></span>
       <span className="vll-payment-mark vll-mark-visa"><img src="https://cdn.prod.website-files.com/65c1399ac999a342139b5069/65c1399ac999a342139b50c9_visa-color.svg" alt="Visa" loading="lazy" decoding="async" referrerPolicy="no-referrer"/></span>
       <span className="vll-payment-mark vll-mark-mastercard"><img src="https://cdn.prod.website-files.com/65c1399ac999a342139b5069/65c1399ac999a342139b50b0_mastercard-color.svg" alt="Mastercard" loading="lazy" decoding="async" referrerPolicy="no-referrer"/></span>
       <span className="vll-payment-mark vll-mark-elo"><img src="https://cdn.prod.website-files.com/65c1399ac999a342139b5069/66765121f809d1dbcc9d3469_elo_badge.svg" alt="Elo" loading="lazy" decoding="async" referrerPolicy="no-referrer"/></span>
       <span className="vll-payment-mark vll-mark-amex"><img src="https://cdn.prod.website-files.com/65c1399ac999a342139b5069/65d3ebcbef002fade4c9fd32_icon-flag-amex.svg" alt="American Express" loading="lazy" decoding="async" referrerPolicy="no-referrer"/></span>
      </div>
      <p>Pix e cartões Visa, Mastercard, Elo e American Express. Opções e condições confirmadas no checkout da InfinitePay. Nunca informe dados de cartão pelo chat.</p>
     </section>
    </div>
    <section className="vll-trust" aria-label="Compre com tranquilidade">
     <div className="vll-trust-heading"><span>VELLOR MENSWEAR</span><h2>Compre com tranquilidade.</h2></div>
     <div className="vll-trust-grid">
      <Link href="/termos-de-compra" className="vll-trust-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2 20 6v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg><span><strong>Pagamento protegido</strong><small>Checkout processado pela InfinitePay.</small></span></Link>
      <Link href="/entregas" className="vll-trust-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="12" height="12" rx="1"/><path d="M14.5 10h4l3 3v5h-7"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg><span><strong>Envio em até 3 dias</strong><small>Postagem após a confirmação do pagamento.</small></span></Link>
      <Link href="/conta" className="vll-trust-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7 12 3l9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10"/><path d="m9 16 2 2 4-4"/></svg><span><strong>Acompanhe seu pedido</strong><small>Atualizações disponíveis na sua conta.</small></span></Link>
      <Link href="/trocas-e-devolucoes" className="vll-trust-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9M3 4v8h8"/><path d="m8 13 3 3 5-6"/></svg><span><strong>Devolução em 7 dias</strong><small>Seu direito de arrependimento é respeitado.</small></span></Link>
     </div>
    </section>
    <nav className="vll-policy-links" aria-label="Informações e políticas da VELLOR">
     <Link href="/entregas">Entrega e prazos</Link>
     <Link href="/trocas-e-devolucoes">Trocas e devoluções</Link>
     <Link href="/privacidade">Política de privacidade</Link>
     <Link href="/termos-de-compra">Termos de compra</Link>
    </nav>
    <StoreIdentity/>
    <div className="vll-footer-bottom"><span>VELLOR MENSWEAR</span><span>Atendimento e informações para sua compra.</span></div>
   </div>
  </footer>
  {showSupport&&<SupportWidget/>}
 </>;
}
