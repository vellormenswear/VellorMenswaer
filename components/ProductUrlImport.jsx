'use client';
import {useState} from 'react';
export default function ProductUrlImport({url,onUrl,onImport,onBusy,disabled}){
 const [message,setMessage]=useState('');
 async function run(source=url,snapshot){
  if(disabled||!source.trim())return;
  setMessage('');onBusy(true);
  try{
   const r=await fetch('/api/product-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:source,...(snapshot?{snapshot}:{})}),cache:'no-store'});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Não foi possível importar o anúncio.');
   onImport(j.product);onUrl(j.url);
   setMessage(j.product.variants_incomplete?'Dados gerais importados. Complete manualmente as variações não identificadas.':'Dados encontrados importados. Complete os campos faltantes e os preços manualmente.');
  }catch(e){setMessage(e.message)}finally{onBusy(false)}
 }
 return <div className="field"><label>URL do anúncio do fornecedor<input type="url" maxLength={2048} value={url} onChange={e=>onUrl(e.target.value)} onPaste={e=>{const raw=e.clipboardData.getData('text/plain');if(!raw.startsWith('VELLOR_CAPTURE_V1:'))return;e.preventDefault();if(disabled)return;try{if(raw.length>90000)throw Error();const snapshot=JSON.parse(raw.slice('VELLOR_CAPTURE_V1:'.length));if(typeof snapshot.url!=='string')throw Error();run(snapshot.url,snapshot)}catch{setMessage('Captura do navegador inválida. Capture novamente o anúncio.')}}} placeholder="https://" disabled={disabled}/></label><button type="button" className="btn ghost" disabled={disabled||!url.trim()} onClick={()=>run()}>Importar produto</button>{message&&<p role="status" className="small">{message}</p>}</div>
}
