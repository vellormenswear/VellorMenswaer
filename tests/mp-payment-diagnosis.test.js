import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deriveMpPaymentDiagnosis,safePaymentDetail} from '../lib/mp-payment-diagnosis.mjs';

test('recusa oficialmente informada aparece sem dados pessoais',()=>{
 const p=safePaymentDetail({id:123456789,status:'rejected',status_detail:'cc_rejected_insufficient_amount',
  payment_method_id:'visa',live_mode:false,payer:{email:'private@example.com'},card:{card_number:'4111111111111111'}});
 const d=deriveMpPaymentDiagnosis({verifiedPayments:[p]});
 assert.equal(d.code,'cc_rejected_insufficient_amount');
 assert.equal(d.source,'mercado_pago_payment_status_detail');
 assert.equal(d.exact_provider_reason,true);
 assert.equal(JSON.stringify({p,d}).includes('private@example.com'),false);
 assert.equal(JSON.stringify({p,d}).includes('4111111111111111'),false);
});

test('sem pagamento, não inventa falha do CVV, CSP ou challenge',()=>{
 const d=deriveMpPaymentDiagnosis({merchantOrders:{query_ok:true,orders:[{order_id:'123',payments:[]}]}});
 assert.equal(d.code,'PAYMENT_NOT_FOUND');
 assert.equal(d.exact_provider_reason,false);
 assert.equal(d.support_required,true);
 assert.doesNotMatch(d.message,/CVV|CSP|challenge|cartao recusado/i);
});

test('pagamento aprovado e estado local pendente exige verificar conciliacao',()=>{
 const d=deriveMpPaymentDiagnosis({verifiedPayments:[{payment_id:'123456',status:'approved',status_detail:'accredited'}],localStatus:'pending'});
 assert.equal(d.code,'RECONCILIATION_PENDING');
 assert.equal(d.exact_provider_reason,false);
});
test('recusa generica continua detalhada apenas no limite informado pelo MP',()=>{
 const d=deriveMpPaymentDiagnosis({verifiedPayments:[{payment_id:'123456',status:'rejected',status_detail:'cc_rejected_other_reason'}]});
 assert.equal(d.code,'cc_rejected_other_reason');
 assert.match(d.message,/pode nao detalhar/);
});
test('nao considera pagamento de recebedor incorreto como prova de recusa',()=>{
 const d=deriveMpPaymentDiagnosis({paymentDetails:[{verified:false,code:'PAYMENT_INTEGRITY_MISMATCH'}]});
 assert.equal(d.code,'PAYMENT_INTEGRITY_MISMATCH');
 assert.equal(d.exact_provider_reason,false);
});
test('falha de consulta nao e confundida com pagamento inexistente',()=>{
 const d=deriveMpPaymentDiagnosis({merchantOrders:{query_ok:false,api_error:{http_status:403,code:'forbidden',request_id:'abc123xyz'}}});
 assert.equal(d.code,'INCOMPLETE_PROVIDER_DIAGNOSTIC');
 assert.equal(d.api_errors[0].code,'forbidden');
});
test('requisicao /v1/payments por ID exige validacao de referencia e recebedor',()=>{
 const route=readFileSync('app/api/admin/payment-diagnostics/route.js','utf8');
 assert.match(route,/mpRequest\('\/v1\/payments\/'\+id,token/);
 assert.match(route,/payment\.external_reference/);
 assert.match(route,/payment\.collector_id/);
 assert.match(route,/payment\.currency_id==='BRL'/);
 assert.match(route,/diagnostics_version:2/);
 assert.match(route,/requireRole\(req,\['super_admin'\]\)/);
 assert.match(route,/MP_MODE==='sandbox'/);
 assert.match(route,/read_only:true/);
});
