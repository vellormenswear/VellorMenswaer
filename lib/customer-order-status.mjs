export const CUSTOMER_ORDER_LABELS=Object.freeze({
 awaiting_payment:'Aguardando pagamento',
 payment_failed:'Pagamento não aprovado',
 paid:'Pagamento confirmado',
 processing:'Pedido em preparação',
 packing:'Preparando o envio',
 shipped:'Enviado',
 delivered:'Entregue',
 cancel_requested:'Cancelamento solicitado',
 return_requested:'Devolução solicitada',
 canceled:'Cancelado',
 refunded:'Reembolsado'
});
export const CUSTOMER_PAYMENT_LABELS=Object.freeze({
 pending:'Aguardando confirmação',
 approved:'Pagamento confirmado',
 rejected:'Pagamento não aprovado',
 refunded:'Reembolsado',
 partial_refund:'Reembolso parcial',
 refund_pending:'Reembolso em análise',
 refund_failed:'Reembolso não concluído'
});
export const CUSTOMER_REQUEST_LABELS=Object.freeze({
 open:'Solicitação recebida',
 under_review:'Em análise',
 approved:'Aprovada',
 rejected:'Não aprovada',
 resolved:'Concluída'
});
export const CUSTOMER_REQUEST_TYPES=Object.freeze({cancel:'Cancelamento',return:'Devolução'});
export const customerOrderLabel=status=>CUSTOMER_ORDER_LABELS[status]||'Em acompanhamento';
export const customerPaymentLabel=status=>CUSTOMER_PAYMENT_LABELS[status]||'Em acompanhamento';
export const customerRequestLabel=status=>CUSTOMER_REQUEST_LABELS[status]||'Em acompanhamento';
export const customerRequestType=type=>CUSTOMER_REQUEST_TYPES[type]||'Solicitação';
