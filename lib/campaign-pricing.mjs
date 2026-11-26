import {FEE_BUFFER_BPS} from './campaigns.mjs';
// Same price expression for public catalogue, quotes and the locked checkout reservation.
export const CAMPAIGN_JOIN="LEFT JOIN LATERAL (SELECT COALESCE(MAX(GREATEST(camp.store_bps,COALESCE((camp.product_discounts->>p.id::text)::int,0))),0)::int AS bps FROM store_campaigns camp WHERE camp.enabled AND camp.starts_at<=now() AND camp.ends_at>now()) promotion ON true";
const candidate="(v.price_cents-floor(v.price_cents::numeric*promotion.bps/10000)::int)";
export const CAMPAIGN_PRICE="CASE WHEN promotion.bps>0 AND "+candidate+"-ceil("+candidate+"::numeric*"+FEE_BUFFER_BPS+"/10000)>v.supplier_cost_cents THEN "+candidate+" ELSE v.price_cents END";
export const CAMPAIGN_DISCOUNT="(v.price_cents-("+CAMPAIGN_PRICE+"))";
export function promotionalPrice(price,cost,bps){if(![price,cost,bps].every(Number.isSafeInteger)||price<=cost||cost<1||bps<0||bps>9999)throw Error('Valores inválidos');const next=price-Math.floor(price*bps/10000);return bps>0&&next-Math.ceil(next*FEE_BUFFER_BPS/10000)>cost?next:price}
export function promoGroupSafe(total,cost){return total-Math.ceil(total*FEE_BUFFER_BPS/10000)>cost}
