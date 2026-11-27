// Operational milestone from the recorded administrative payment, not a carrier event.
export const PAYMENT_AWAITING_SHIPMENT='Pagamento realizado aguardando o envio';
export function dispatchConfirmation(row){
 if(row.payment_status!=='approved'||!row.dispatch_confirmed_at)return null;
 return {confirmed_at:row.dispatch_confirmed_at,confirmed_by:row.dispatch_confirmed_by||null,
  awaiting_shipment:['paid','preparing'].includes(row.fulfillment_status)&&['paid','processing','packing'].includes(row.order_status)&&!row.posted_at};
}
export function trackingStage(shipment,labels){
 if(shipment.snapshot)return labels[shipment.snapshot.status]||labels.unknown;
 if(shipment.dispatch_confirmation?.awaiting_shipment)return PAYMENT_AWAITING_SHIPMENT;
 return shipment.tracking_code?'Aguardando atualização':'Aguardando envio';
}
