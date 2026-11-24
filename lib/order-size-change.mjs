// A troca de tamanho mantém a mesma variação/SKU e quantidade.
export const sizeChangeAllowed=(order,group)=>order?.payment_status==='approved'&&['paid','processing','packing'].includes(order.status)&&!order.tracking_code&&group?.payment_status==='approved'&&['awaiting_payout','paid','preparing'].includes(group.fulfillment_status)&&!group.posted_at&&!group.tracking_code;
export const availableSizes=(sizes,current)=>Array.isArray(sizes)?[...new Set(sizes.filter(s=>typeof s==='string'&&s.trim()&&s!==current))]:[];
