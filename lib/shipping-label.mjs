import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import bwipjs from 'bwip-js';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const mm=v=>v*72/25.4;
export const labelSize=format=>format==='a4'?[mm(210),mm(297)]:[mm(100),mm(150)];
export const shipmentBarcode=id=>String(id).replace(/-/g,'').toUpperCase();
const safe=v=>String(v??'').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/[^\u0020-\u007e\u00a0-\u00ff]/g,' ').replace(/\s+/g,' ').trim();
const joined=(...v)=>v.map(safe).filter(Boolean).join(' · ');
// Reproduce the default storefront header, without its seasonal/department overlays.
// The fixed original mark and the WEAR layer share the 1250 × 295 artboard.
// Clip boundary mirrors public/vellor-approved.css (38.4%, 74.57%).
export async function shippingLogoPng(width=750){
 const canvas={width:1250,height:295},x=480,y=220;
 const pixels=async filename=>sharp(await readFile(join(process.cwd(),'public',filename))).resize(canvas.width,canvas.height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 const [fixed,wear]=await Promise.all([pixels('logo-vellor.png'),pixels('logo-vellor-wear.svg')]);
 for(let row=y;row<canvas.height;row++){
  const start=(row*canvas.width+x)*4,end=(row+1)*canvas.width*4;
  wear.copy(fixed,start,start,end);
 }
 return sharp(fixed,{raw:{...canvas,channels:4}}).resize({width}).png().toBuffer();
}
// Default (non-seasonal) brand colors from public/vellor-approved.css.
export async function shippingHeaderPng(){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1250" height="220"><defs><linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#10362c"/><stop offset="50%" stop-color="#242326"/><stop offset="100%" stop-color="#401328"/></linearGradient></defs><rect width="1250" height="220" fill="url(#brand)"/></svg>';
 return sharp(Buffer.from(svg)).png().toBuffer();
}
export async function createShippingLabel({group,items,identity,format}){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const logo=await pdf.embedPng(await shippingLogoPng()),header=await pdf.embedPng(await shippingHeaderPng());
 const barcodeText=shipmentBarcode(group.id),barcode=await pdf.embedPng(await bwipjs.toBuffer({bcid:'code128',text:barcodeText,scale:3,height:14,paddingwidth:10,paddingheight:2}));
 const [pw,ph]=labelSize(format),w=mm(100),h=mm(150),left=(pw-w)/2+12,top=ph-(format==='a4'?mm(12):0)-10,inner=w-24;
 let page,y;
 function start(){
  page=pdf.addPage([pw,ph]);y=top;
  const logoH=Math.min(39,logo.height*145/logo.width),logoW=logoH*logo.width/logo.height;
  page.drawImage(header,{x:left-12,y:y-logoH-4,width:w,height:logoH+8});
  page.drawImage(logo,{x:left+(inner-logoW)/2,y:y-logoH,width:logoW,height:logoH});y-=logoH+9;
  line('ETIQUETA INTERNA DE ENVIO',bold,10);line('Pedido #'+group.order_number,bold,13);
  const codeH=42;page.drawImage(barcode,{x:left,y:y-codeH,width:inner,height:codeH});y-=codeH+3;
  line(barcodeText,font,8);y-=3;
 }
 function line(text,face=font,size=9){
  const raw=safe(text);let chunk='';
  const emit=()=>{if(y<top-h+18)start();page.drawText(chunk,{x:left,y:y-size,font:face,size,color:rgb(0,0,0)});y-=size+3;chunk='';};
  for(const char of raw){if(chunk&&face.widthOfTextAtSize(chunk+char,size)>inner)emit();chunk+=char;}if(chunk)emit();
 }
 function heading(t){y-=4;line(t,bold,10);}
 start();const a=group.recipient_snapshot||{};
 line('Data: '+new Date(group.paid_at||group.created_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}));
 heading('DESTINATÁRIO');line(a.recipient,bold,10);line(joined(a.street,a.number,a.complement));line(joined(a.neighborhood,a.city,a.state));line('CEP: '+safe(a.cep));
 heading('REMETENTE');line(identity.legal_name||'VELLOR WEAR');if(identity.legal_address)line(identity.legal_address);if(identity.legal_document)line('CPF/CNPJ: '+identity.legal_document);line('www.vellorwear.com.br');
 heading('REMESSA');line('Transportadora: '+(safe(group.carrier)||'-'));line('Rastreio: '+(safe(group.tracking_code)||'-'));
 heading('ITENS');for(const i of items)line(joined(i.quantity+' un.',i.product_name_snapshot,i.variant_snapshot,i.size_snapshot,i.sku_snapshot));
 return pdf.save();
}
