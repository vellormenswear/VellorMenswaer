'use client';
import {useEffect,useState} from 'react';
import Frame from '@/components/Frame';
import SupportInbox from '@/components/SupportInbox';
export default function Atendimento(){const [user,setUser]=useState(null),[loaded,setLoaded]=useState(false),[id,setId]=useState(null);
 useEffect(()=>{setId(new URLSearchParams(window.location.search).get('thread'));fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json()).then(d=>setUser(d.user||null)).catch(()=>{}).finally(()=>setLoaded(true))},[]);
 if(!loaded)return <main className="page">Carregando atendimento...</main>;
 if(!['admin','super_admin'].includes(user?.role))return <main className="page"><h1>Acesso restrito aos administradores</h1><a href="/conta">Entrar</a></main>;
 return <Frame user={user}><main className="page" style={{maxWidth:1350}}><div className="flexrow"><h1>Atendimento ao cliente</h1><span className="spacer"/><a className="btn ghost" href="/admin">Voltar ao painel</a></div><SupportInbox initialId={id}/></main></Frame>;
}
