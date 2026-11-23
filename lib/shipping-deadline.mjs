// Prazo comercial de postagem: 3 dias corridos (72 horas) após a aprovação.
export const SHIPPING_DISPATCH_WINDOW_HOURS=72;
const HOUR=3600000;
export function shippingDeadline(paidAt,now=new Date()){
 if(!paidAt)return null;
 const paid=new Date(paidAt),clock=new Date(now);
 if(!Number.isFinite(paid.getTime())||!Number.isFinite(clock.getTime()))return null;
 const end=new Date(paid.getTime()+SHIPPING_DISPATCH_WINDOW_HOURS*HOUR);
 const hoursRemaining=(end.getTime()-clock.getTime())/HOUR;
 return {deadline_at:end.toISOString(),
  hours_remaining:Math.ceil(hoursRemaining),
  alert:hoursRemaining<0?'late':hoursRemaining<=24?'urgent':'on_track'};
}
export function isShipmentPending(row){
 const total=Number(row.shipment_count||0),finished=Number(row.shipments_finished||0);
 if(total>0)return finished<total;
 return !['shipped','delivered','canceled','refunded'].includes(row.status);
}
export function shippingAlerts(orders,now=new Date()){
 return orders.filter(o=>o.payment_status==='approved'&&isShipmentPending(o)&&o.paid_at)
  .map(o=>({...o,shipping_sla:shippingDeadline(o.paid_at,now)}))
  .filter(o=>o.shipping_sla)
  .sort((a,b)=>new Date(a.shipping_sla.deadline_at)-new Date(b.shipping_sla.deadline_at));
}
