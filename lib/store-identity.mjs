// Identificação legal do vendedor: dados públicos exigidos no comércio eletrônico.
// Nunca preencha automaticamente CPF, CNPJ ou endereço por suposição.
export const IDENTITY_FIELDS=['legal_name','legal_document','legal_address','legal_email'];
const clean=v=>String(v??'').trim();
export function isBrazilianDocument(raw){
 const n=clean(raw).replace(/\D/g,'');
 if(![11,14].includes(n.length)||/^(\d)\1+$/.test(n))return false;
 const digit=(values,weights)=>{const sum=weights.reduce((s,w,i)=>s+Number(values[i])*w,0),r=sum%11;return r<2?0:11-r;};
 if(n.length===11){
  const a=digit(n.slice(0,9),[10,9,8,7,6,5,4,3,2]),b=digit(n.slice(0,10),[11,10,9,8,7,6,5,4,3,2]);
  return a===Number(n[9])&&b===Number(n[10]);
 }
 const a=digit(n.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]);
 const b=digit(n.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2]);
 return a===Number(n[12])&&b===Number(n[13]);
}
export function normalizeIdentity(raw){
 const r=raw||{};
 const identity=Object.fromEntries(IDENTITY_FIELDS.map(key=>[key,clean(r[key])]));
 identity.legal_document=identity.legal_document.replace(/\D/g,'');
 const validName=identity.legal_name.length>=3&&identity.legal_name.length<=200;
 const validDoc=isBrazilianDocument(identity.legal_document);
 const validAddress=identity.legal_address.length>=15&&identity.legal_address.length<=400;
 const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.legal_email)&&identity.legal_email.length<=200;
 return {...identity,complete:validName&&validDoc&&validAddress&&validEmail,fields_present:Object.fromEntries(IDENTITY_FIELDS.map(key=>[key,Boolean(identity[key])]))};
}
export function identityFromRows(rows=[]){
 return normalizeIdentity(Object.fromEntries(rows.filter(x=>IDENTITY_FIELDS.includes(x.key)).map(x=>[x.key,x.value])));
}
export function formatBrazilianDocument(raw){
 const n=clean(raw).replace(/\D/g,'');
 if(n.length===11)return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
 if(n.length===14)return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');
 return '';
}
export function publicLegalIdentity(identity){
 if(!identity?.complete)return {complete:false};
 return {complete:true,legal_name:identity.legal_name,
  legal_document:formatBrazilianDocument(identity.legal_document),
  legal_document_kind:identity.legal_document.length===11?'CPF':'CNPJ',
  legal_address:identity.legal_address,legal_email:identity.legal_email};
}
