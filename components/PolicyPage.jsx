import Link from 'next/link';
import Frame from '@/components/Frame';
import {LEGAL_POLICIES,LEGAL_LINKS,LEGAL_UPDATED} from '@/lib/vellor-policies.mjs';

export default function PolicyPage({slug}){
 const p=LEGAL_POLICIES[slug];
 if(!p)return null;
 return <Frame user={null}>
  <main className="page vll-policy" id="conteudo">
   <nav className="vll-policy-crumb" aria-label="Navegação estrutural"><Link href="/vitrine.html">VELLOR</Link><span aria-hidden="true">/</span><span>{p.title}</span></nav>
   <header className="vll-policy-hero">
    <p className="vll-policy-eyebrow">{p.eyebrow}</p>
    <h1>{p.title}</h1>
    <p>{p.lead}</p>
    <p className="vll-policy-date">Atualizada em {LEGAL_UPDATED}</p>
   </header>
   <div className="vll-policy-layout">
    <article className="vll-policy-article">
     {p.sections.map(section=><section className="vll-policy-section" key={section.title}>
       <h2>{section.title}</h2>
       {section.paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}
      </section>)}
     <aside className="vll-policy-contact">
      <h2>Precisa de ajuda?</h2>
      <p>Fale com a equipe VELLOR pelo atendimento da loja. Se já comprou, acesse sua conta para consultar o pedido ou solicitar suporte.</p>
      <div><Link href="/conta" className="vll-policy-action">Minha conta e pedidos</Link><Link href="/vitrine.html#informacoes-vellor">Atendimento VELLOR</Link></div>
     </aside>
    </article>
    <nav className="vll-policy-side" aria-label="Políticas da VELLOR">
     <h2>Informações úteis</h2>
     {LEGAL_LINKS.map(link=><Link key={link.href} href={link.href} aria-current={link.href==='/'+slug?'page':undefined}>{link.label}<span aria-hidden="true">↗</span></Link>)}
    </nav>
   </div>
  </main>
 </Frame>;
}
