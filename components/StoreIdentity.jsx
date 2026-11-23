'use client';
import {useEffect,useState} from 'react';
export default function StoreIdentity(){
 const [identity,setIdentity]=useState(null);
 useEffect(()=>{let mounted=true;
  fetch('/api/store/identity',{cache:'no-store'})
   .then(r=>r.ok?r.json():null)
   .then(r=>{if(mounted&&r?.complete)setIdentity(r)})
   .catch(()=>{});
  return()=>{mounted=false};
 },[]);
 if(!identity)return null;
 return <section className="vll-legal-identity" aria-label="Identificação do responsável comercial pela VELLOR">
  <strong>Identificação do responsável comercial</strong>
  <p>{identity.legal_name} · {identity.legal_document_kind}: {identity.legal_document}</p>
  <p>{identity.legal_address}</p>
  <a href={'mailto:'+identity.legal_email}>{identity.legal_email}</a>
 </section>;
}
