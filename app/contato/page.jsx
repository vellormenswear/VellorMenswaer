import Link from 'next/link';
import Frame from '@/components/Frame';
export const metadata={title:'Contato | VellorWear',description:'Entre em contato com a equipe VELLOR.'};
export default function Contato(){return <Frame user={null}>
 <main className="page vll-policy" id="conteudo">
  <nav className="vll-policy-crumb" aria-label="Navegação estrutural"><Link href="/">VELLOR</Link><span aria-hidden="true">/</span><span>Contato</span></nav>
  <header className="vll-policy-hero"><p className="vll-policy-eyebrow">ATENDIMENTO VELLOR</p><h1>Fale com a VELLOR</h1><p>Estamos à disposição para esclarecer dúvidas sobre produtos, compras, entregas, trocas e devoluções.</p></header>
  <section className="vll-policy-contact"><h2>E-mail comercial</h2><p><a href="mailto:contato@vellorwear.com.br">contato@vellorwear.com.br</a></p><p>Se já realizou uma compra, informe o número do pedido. Nunca envie senhas ou dados completos do cartão.</p><div><Link href="/conta" className="vll-policy-action">Minha conta e pedidos</Link><Link href="/#informacoes-vellor">Central de ajuda</Link></div></section>
 </main>
 </Frame>}
