import {HttpError} from '@/lib/http';import {money} from '@/lib/commerce';
const ROOT='https://api.mercadopago.com/v1/orders';
function token(){const t=process.env.MP_TEST_ACCESS_TOKEN||'';if(process.env.MP_MODE!=='sandbox'||!t||!t.startsWith('TEST-'))throw new HttpError(503,'Mercado Pago de testes não configurado.');return t}
export async function mpFetch(method,endpoint,data=null,idempotency=null){const t=token();const h={Authorization:`Bearer ${t}`,'Content-Type':'application/json','Accept':'application/json'};if(idempotency)h['X-Idempotency-Key']=idempotency;
 const r=await fetch(ROOT+endpoint,{method,headers:h,body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
 const out=await r.json().catch(()=>({}));if(!r.ok)throw new HttpError(502,`Falha no serviço de pagamento de testes (${r.status}).`);return out;}
export async function createMPOrder(order,lines,email,idempotency){const total=money(order.total_cents);const items=[...lines.map(x=>({title:(x.name+' — '+x.variant+(x.size?' ('+x.size+')':'')).slice(0,180),quantity:x.qty,unit_price:money(x.unit_cents)}))];
 // Checkout Pro Orders requires sum(quantity × unit_price) = total_amount; discounts and shipping are separate accounting items.
 if(order.shipping_cents>0)items.push({title:'Frete',quantity:1,unit_price:money(order.shipping_cents)});
 if(order.discount_cents>0){
  // A negative line item is not valid for this API: distribute discount across line units in integer cents.
  const units=[];for(const x of lines)for(let i=0;i<x.qty;i++)units.push({title:x.name+' — '+x.variant,price:x.unit_cents});
  let left=order.discount_cents;for(const x of units){const v=Math.min(left,x.price);x.price-=v;left-=v;if(!left)break}
  if(left)throw new HttpError(400,'Cupom inconsistente.');
  const byIndex=units.map(x=>({title:x.title,quantity:1,unit_price:money(x.price)}));
  items.length=0;items.push(...byIndex);if(order.shipping_cents>0)items.push({title:'Frete',quantity:1,unit_price:money(order.shipping_cents)});
 }
 const site=(process.env.SITE_URL||'').replace(/\/$/,'');if(!site.startsWith('https://'))throw new HttpError(503,'Configure SITE_URL com HTTPS antes do checkout de teste.');
 const back=site+'/pagamento/retorno';const body={type:'online',processing_mode:'manual',total_amount:total,external_reference:order.id,payer:{email},items,description:`Vellor Menswear — pedido ${order.order_number}`,config:{online:{success_url:back,failure_url:back,pending_url:back,auto_return:'approved'}}};
 const mp=await mpFetch('POST','',body,idempotency);if(!mp.checkout_url||!mp.id)throw new HttpError(502,'Mercado Pago não retornou link seguro para pagamento.');return mp;
}
export async function fetchMPOrder(id){if(!/^ORD[A-Z0-9_-]{8,120}$/i.test(String(id)))throw new HttpError(400,'Identificador inválido.');return mpFetch('GET','/'+encodeURIComponent(id));}
