import {redirect} from 'next/navigation';
export default async function Atendimento({searchParams}){const p=await searchParams;const thread=typeof p.thread==='string'?'&thread='+encodeURIComponent(p.thread):'';redirect('/admin?tab=requests'+thread)}
