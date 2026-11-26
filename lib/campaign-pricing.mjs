import {FEE_BUFFER_BPS} from './campaigns.mjs';
// Same price expression for public catalogue, quotes and the locked checkout reservation.
export const CAMPAIGN_JOIN="LEFT JOIN LATERAL (SELECT COALESCE(MAX(GREATEST(camp.store_bps,COALESCE((camp.product_discounts->>p.id::text)::int,0))),0)::int AS bps FROM store_campaigns camp WHERE camp.enabled AND camp.starts_at<=now() AND camp.ends_at>now()) promotion ON true";
const candidate="(v.price_cents-floor(v.price_cents::numeric*promotion.bps/10000)::int)";
export const CAMPAIGN_PRICE="CASE WHEN promotion.bps>0 AND "+candidate+"-ceil("+candidate+"::numeric*"+FEE_BUFFER_BPS+"/10000)>v.supplier_cost_cents THEN "+candidate+" ELSE v.price_cents END";
// Exclusive Pix offers: choose the best valid price; stacking is explicit per campaign.
const pixBps="GREATEST(cp.pix_bps,COALESCE((cp.pix_product_discounts->>p.id::text)::int,0))";
const pixBase="(CASE WHEN cp.pix_accumulate THEN ("+CAMPAIGN_PRICE+") ELSE v.price_cents END)";
const pixCandidate="("+pixBase+"-floor("+pixBase+"::numeric*"+pixBps+"/10000)::int)";
export const CAMPAIGN_PIX_JOIN="LEFT JOIN LATERAL (SELECT MIN("+pixCandidate+") FILTER (WHERE "+pixCandidate+"-ceil("+pixCandidate+"::numeric*"+FEE_BUFFER_BPS+"/10000)>v.supplier_cost_cents) AS price FROM store_campaigns cp WHERE cp.enabled AND cp.starts_at<=now() AND cp.ends_at>now() AND "+pixBps+">0) pix_offer ON true";
export const CAMPAIGN_PIX_PRICE="LEAST(("+CAMPAIGN_PRICE+"),COALESCE(pix_offer.price,v.price_cents))";
export const CAMPAIGN_DISCOUNT="(v.price_cents-("+CAMPAIGN_PRICE+"))";
export function promotionalPrice(price,cost,bps){if(![price,cost,bps].every(Number.isSafeInteger)||price<=cost||cost<1||bps<0||bps>9999)throw Error('Valores inválidos');const next=price-Math.floor(price*bps/10000);return bps>0&&next-Math.ceil(next*FEE_BUFFER_BPS/10000)>cost?next:price}
export function promoGroupSafe(total,cost){return total-Math.ceil(total*FEE_BUFFER_BPS/10000)>cost}

export function campaignPixPrice(price,cost,generalBps,pixBps,accumulate){
 const normal=promotionalPrice(price,cost,generalBps);
 const base=accumulate?normal:price;
 const candidate=promotionalPrice(base,cost,pixBps);
 return Math.min(normal,candidate);
}
// A provider link supports one percentage, not per-product rates. Translate the
// eligible item savings to a conservative effective percentage of the order.
export function pixPlan(groups){
 const rows=groups.map(g=>{
  const items=g.items_snapshot||g.items||[];
  const total=Number(g.amount_cents??g.total),cost=Number(g.supplier_amount_cents??g.cost);
  const subtotal=Number(g.subtotal_cents??g.subtotal);
  if(![total,cost,subtotal].every(Number.isSafeInteger)||total<1||subtotal<total||cost<0||cost>=total)throw Error('Grupo inválido para Pix');
  const raw=items.reduce((s,i)=>s+Math.max(0,(i.unit_cents-(i.pix_unit_cents??i.unit_cents))*i.qty),0);
  // A separate coupon already distributed across suppliers must not be discounted twice.
  const desired=Math.floor(raw*total/subtotal);
  const minSafe=Math.floor(cost*10000/(10000-FEE_BUFFER_BPS))+2;
  return {id:g.id??g.supplier_id,total,cap:Math.max(0,Math.min(desired,total-minSafe))};
 });
 const total=rows.reduce((s,r)=>s+r.total,0),capacity=rows.reduce((s,r)=>s+r.cap,0);
 const bps=total>=100?Math.max(0,Math.min(9999,Math.floor(Math.min(capacity,total-100)*10000/total))):0;
 const floor=Math.floor(total*bps/10000),ceil=Math.ceil(total*bps/10000);
 return {rows,total,bps:floor>0?bps:0,floor:floor>0?floor:0,ceil:floor>0?ceil:0};
}
export function allocatePixDiscount(plan,amount){
 if(!Number.isSafeInteger(amount)||amount<plan.floor||amount>plan.ceil)throw Error('Desconto Pix divergente');
 const cap=plan.rows.reduce((s,r)=>s+r.cap,0);
 if(amount>cap)throw Error('Desconto Pix excede margem');
 let remaining=amount;
 const shares=plan.rows.map(r=>({id:r.id,cap:r.cap,discount:cap?Math.floor(amount*r.cap/cap):0}));
 remaining-=shares.reduce((s,r)=>s+r.discount,0);
 for(const r of shares){const n=Math.min(remaining,r.cap-r.discount);r.discount+=n;remaining-=n}
 if(remaining)throw Error('Rateio Pix incompleto');
 return new Map(shares.map(r=>[r.id,r.discount]));
}
