import {createHash} from 'node:crypto';
import {normalizePixKey} from './supplier-pix.mjs';
const tlv=(id,value)=>{const len=Buffer.byteLength(value,'utf8');if(!len||len>99)throw Error('Campo BR Code inválido');return id+String(len).padStart(2,'0')+value};
const emv=(s,n)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 .\-]/g,'').trim().slice(0,n);
export function crc16(text){let crc=0xffff;for(const byte of Buffer.from(text,'utf8')){crc^=byte<<8;for(let i=0;i<8;i++)crc=((crc<<1)^((crc&0x8000)?0x1021:0))&0xffff;}return crc.toString(16).toUpperCase().padStart(4,'0')}
export function payoutPayload({group_id,pix_type,pix_key,pix_holder_name,supplier_amount_cents},city){
 const key=normalizePixKey(pix_type,pix_key),name=emv(pix_holder_name,25),merchantCity=emv(city,15),amount=Number(supplier_amount_cents);
 if(!key||!name||!merchantCity||!group_id||!Number.isSafeInteger(amount)||amount<=0)throw Error('Dados de repasse Pix incompletos');
 const total=String(Math.floor(amount/100))+'.'+String(amount%100).padStart(2,'0');
 if(total.length>13)throw Error('Valor fora do padrão BR Code');
 const txid=createHash('sha256').update(String(group_id)).digest('hex').slice(0,25);
 const payload=tlv('00','01')+tlv('26',tlv('00','br.gov.bcb.pix')+tlv('01',key))+tlv('52','0000')+tlv('53','986')+tlv('54',total)+tlv('58','BR')+tlv('59',name)+tlv('60',merchantCity)+tlv('62',tlv('05',txid))+'6304';
 return payload+crc16(payload);
}
