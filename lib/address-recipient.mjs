export const cleanCep=v=>String(v??'').replace(/\D/g,'').slice(0,8);
export function cepFields(data){return {street:String(data.logradouro??''),neighborhood:String(data.bairro??''),city:String(data.localidade??''),state:String(data.uf??'')};}
export function mergeCep(address,result,requested){if(cleanCep(address.cep)!==requested)return address;return {...address,street:result.street||'',neighborhood:result.neighborhood||'',city:result.city||'',state:result.state||''};}
export function recipientForAddress(address,customerName){const name=String(customerName??'').trim();if(address.deliver_to_third_party===true)return String(address.recipient??'').trim();if(address.deliver_to_third_party===false)return name;
const previous=String(address.recipient??'').trim();return /\p{L}/u.test(previous)?previous:name;}
export function recipientSnapshot(address,customerName){return {...address,recipient:recipientForAddress(address,customerName),deliver_to_third_party:address.deliver_to_third_party===true};}
export function validRecipient(value){return /\p{L}/u.test(String(value??'').trim())&&String(value??'').trim().length>=2;}
