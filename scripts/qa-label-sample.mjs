import {createShippingLabel} from '../lib/shipping-label.mjs';
import {writeFile} from 'node:fs/promises';
if(process.env.VERCEL_ENV==='preview'){
 const group={id:'24681012-1234-4567-8901-123456789012',order_number:123,created_at:'2026-11-26T12:00:00Z',recipient_snapshot:{recipient:'DESTINATÁRIO DE EXEMPLO',street:'Rua de Exemplo',number:'100',neighborhood:'Bairro de Exemplo',city:'Rio de Janeiro',state:'RJ',cep:'00000000'}};
 const items=[{quantity:1,product_name_snapshot:'Camiseta de exemplo',variant_snapshot:'Preta',size_snapshot:'M',sku_snapshot:'SKU-EXEMPLO'}];
 for(const [format,name] of [['thermal','termica'],['a4','a4']]){
  const bytes=await createShippingLabel({group,items,identity:{legal_name:'VELLOR WEAR'},format});
  await writeFile('public/etiqueta-amostra-'+name+'.pdf',bytes);
  console.log('[label.sample] '+name+' PDF generated '+bytes.length+' bytes');
 }
}
