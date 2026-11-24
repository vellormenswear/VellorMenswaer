// Fixed predicates; never interpolate a user-provided status into SQL.
export const ADMIN_ORDER_FILTERS=Object.freeze([
 ['all','Todos'],['approved','Pagamento aprovado'],['refund_pending','Estorno pendente'],['refunded','Estornado'],['partial_refund','Estorno parcial'],['refund_failed','Falha no estorno'],['canceled','Cancelado'],['awaiting_payment','Aguardando pagamento'],['payment_failed','Pagamento não aprovado'],['processing','Em preparação'],['packing','Em separação'],['shipped','Enviado'],['delivered','Entregue'],['cancel_requested','Cancelamento solicitado'],['return_requested','Devolução solicitada']
]);
export const pendingRefund=o=>o.payment_status==='refund_pending'||(o.status==='canceled'&&o.payment_status==='approved')||o.group_refund_pending===true;
export const failedRefund=o=>o.payment_status==='refund_failed'||o.group_refund_failed===true;
export function adminOrderPaymentLabel(o,fallback){
 if(failedRefund(o))return 'Falha no estorno';
 if(pendingRefund(o))return 'Estorno pendente';
 if(o.payment_status==='refunded'||o.status==='refunded')return 'Estornado';
 return fallback(o.payment_status);
}
export const ORDER_FILTER_SQL=Object.freeze({
 all:'TRUE',
 approved:"o.payment_status='approved' AND o.status<>'canceled' AND NOT "+'refund_flags.group_refund_pending AND NOT refund_flags.group_refund_failed',
 refund_pending:"(o.payment_status='refund_pending' OR (o.status='canceled' AND o.payment_status='approved') OR refund_flags.group_refund_pending) AND NOT (o.payment_status='refund_failed' OR refund_flags.group_refund_failed)",
 refunded:"(o.payment_status='refunded' OR o.status='refunded')",
 partial_refund:"o.payment_status='partial_refund'",
 refund_failed:"(o.payment_status='refund_failed' OR refund_flags.group_refund_failed)",
 canceled:"o.status='canceled'",
 awaiting_payment:"o.status='awaiting_payment'",
 payment_failed:"(o.status='payment_failed' OR o.payment_status='rejected')",
 processing:"o.status='processing'",packing:"o.status='packing'",shipped:"o.status='shipped'",delivered:"o.status='delivered'",cancel_requested:"o.status='cancel_requested'",return_requested:"o.status='return_requested'"
});
export function orderFilterPredicate(filter){return Object.hasOwn(ORDER_FILTER_SQL,filter)?ORDER_FILTER_SQL[filter]:null}
export const ADMIN_ORDER_PAGE_SIZE=50;
