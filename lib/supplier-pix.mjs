import {isBrazilianDocument} from './store-identity.mjs';

// A chave informa o destino do repasse manual, não valida se a conta existe no DICT.
// O recebedor deve ser conferido no banco antes do envio do Pix.
export const PIX_TYPES=Object.freeze(['cpf','cnpj','email','phone','random']);
const onlyDigits=value=>String(value||'').replace(/\D/g,'');
export function normalizePixKey(type,value){
 const t=String(type||'').trim().toLowerCase(),raw=String(value||'').trim();
 if(!PIX_TYPES.includes(t)||!raw||raw.length>255)return null;
 if(t==='cpf'||t==='cnpj'){
  const key=onlyDigits(raw);
  if(key.length!==(t==='cpf'?11:14)||!isBrazilianDocument(key))return null;
  return key;
 }
 if(t==='email'){
  const key=raw.toLowerCase();
  return key.length<=77&&/^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(key)?key:null;
 }
 if(t==='phone'){
  const digits=onlyDigits(raw);
  const normalized=digits.length===11?'55'+digits:digits;
  return /^55[1-9][0-9]9[0-9]{8}$/.test(normalized)?'+'+normalized:null;
 }
 if(t==='random')return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)?raw.toLowerCase():null;
 return null;
}
export function normalizePixCity(value){
 const city=String(value??'').trim().replace(/\s+/g,' ');
 return city.length>=2&&city.length<=120&&/^[\p{L}\p{M} .’'\-]+$/u.test(city)&&/\p{L}/u.test(city)?city:null;
}
export function parseSupplierPix(input){
 const pix_type=String(input?.pix_type||'').trim().toLowerCase();
 const pix_key=normalizePixKey(pix_type,input?.pix_key);
 const holder_name=String(input?.pix_holder_name||'').trim().replace(/\s+/g,' ');
 if(!pix_key||holder_name.length<3||holder_name.length>120||/[<>]/.test(holder_name))return null;
 return {pix_type,pix_key,holder_name};
}
export function maskPixKey(type,key){
 const k=String(key||'');
 if(!k)return '';
 if(type==='email'){
  const at=k.indexOf('@');
  return at<1?'••••':k.slice(0,1)+'••••'+k.slice(at);
 }
 return '••••'+k.slice(-4);
}
export function supplierPixSummary(row){
 if(!row)return {registered:false};
 return {registered:true,pix_type:row.pix_type,
  pix_key_mask:maskPixKey(row.pix_type,row.pix_key),pix_holder_name:row.holder_name,
  updated_at:row.updated_at};
}
