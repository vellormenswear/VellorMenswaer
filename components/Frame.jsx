'use client';
import Link from 'next/link';
export default function Frame({children,user,logout}){return <><header className="brandbar"><Link href="/"><img src="/logo-vellor.png" alt="Vellor Menswear"/></Link><nav><Link href="/">VITRINE</Link><Link href="/conta">MINHA CONTA</Link>{user?.role==='supplier'&&<Link href="/fornecedor">FORNECEDOR</Link>}{['employee','admin','super_admin'].includes(user?.role)&&<Link href="/admin">ADMINISTRAÇÃO</Link>}{user&&<button onClick={logout}>SAIR</button>}</nav></header>{children}</>}
