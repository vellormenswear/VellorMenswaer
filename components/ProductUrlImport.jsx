'use client';
import {useState} from 'react';
export default function ProductUrlImport({url,onUrl,onImport,onBusy,disabled}){
 const [message,setMessage]=useState('');
 async function run(){
  if(disabled||!url.trim())return;
  setMessage('');onBusy(true);
  try{
   const r=await fetch('/api/product-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),cache:'no-store'});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Não foi possível importar o anúncio.');
   onImport(j.product);onUrl(j.url);
   setMessage(j.product.variants_incomplete?'Dados gerais importados. Complete manualmente as variações não identificadas.':'Dados encontrados importados. Complete os campos faltantes e os preços manualmente.');
  }catch(e){setMessage(e.message)}finally{onBusy(false)}
 }
 return <div className="field"><label>URL do anúncio do fornecedor<input type="url" maxLength={2048} value={url} onChange={e=>onUrl(e.target.value)} placeholder="https://" disabled={disabled}/></label><button type="button" className="btn ghost" disabled={disabled||!url.trim()} onClick={run}>Importar produto</button>{message&&<p role="status" className="small">{message}</p>}</div>
}
