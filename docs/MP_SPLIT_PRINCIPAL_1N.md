# VELLOR — vendedora principal e Split 1:N

## Modelo correto de recebimento

A VELLOR vende diretamente ao consumidor e é identificada como owner. Cada fornecedor é partner e recebe sua parcela de custo. Exemplo bruto: comprador paga R$ 170, VELLOR recebe R$ 70 e fornecedor recebe R$ 100, antes das tarifas do Mercado Pago. Não existe margem mínima obrigatória de 70%.

No checkout atual a VELLOR usa Checkout Pro + Split 1:1, no qual o fornecedor é o collector e a VELLOR recebe marketplace_fee. Mesmo com montantes parecidos, isso não corresponde ao papel de owner principal que foi definido.

Para dividir automaticamente entre owner e partners no mesmo pagamento, o Mercado Pago documenta Split Payments 1:N via Checkout Transparente e Orders API, com autorização comercial prévia. Não é possível implementar o modelo de owner principal em Checkout Pro com uma variável.

Documentação oficial:
https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/resources/split-payments-1-n

## O que foi preparado nesta branch

- lib/mp-primary-split-1n.mjs: cálculo em centavos e payload de Split 1:N com owner e partner consentido, até dez fornecedores, sem marketplace_fee.
- app/api/admin/mp-primary-1n-canary/route.js: laboratório isolado acessível apenas ao superadministrador em sandbox, usando o Access Token de teste da conta principal, verificando identidade do owner e consentimento ACTIVE do fornecedor, criando Order PIX 1:N de teste e consultando a resposta oficial.
- app/admin/mp-primary-1n/page.jsx: tela de diagnóstico para consentimento e Order de R$ 170 dividida em R$ 70/R$ 100.
- tests/mp-primary-split-1n.test.js: valores, limites, consentimento, ambiente, identidade da aplicação e integridade da order.

O laboratório NÃO substitui o checkout comercial, NÃO grava ou concilia pedidos VELLOR, NÃO paga fornecedores, NÃO altera o Neon e NÃO ativa pagamentos reais. A migração do checkout do consumidor vem depois da habilitação 1:N e dos testes.

## Variáveis para a etapa seguinte (não alterar ainda)

- MP_MODE=sandbox
- MP_LIVE_ENABLED=false
- MP_PRIMARY_1N_ENABLED=false (ativar somente laboratório)
- MP_PRIMARY_1N_APPROVED=false (habilitação comercial deve ser confirmada)
- MP_TEST_ACCESS_TOKEN= (token de TESTE da aplicação VELLOR/owner, apenas no servidor)
- MP_PRIMARY_TEST_SELLER_USER_ID= (User ID da conta VELLOR principal de teste, não Client ID)
- MP_SECONDARY_TEST_SELLER_EMAIL= (nome do fornecedor no formato USERNAME@testuser.com)
- MP_SECONDARY_TEST_RECEIVER_ID= (UUID retornado pelo consentimento ACTIVE; NÃO é User ID)
- MP_SANDBOX_TEST_CUSTOMER_EMAIL= (comprador sandbox)

O laboratório NÃO usa o token OAuth do fornecedor nem exige Client Secret do aplicativo de teste. OAuth do fornecedor permanece no sistema 1:1 antigo até a migração definitiva.

## Ordem de homologação

1. Confirmar formalmente acesso ao Split 1:N junto ao Mercado Pago.
2. Verificar conta principal, fornecedor secundário e comprador de teste.
3. Configurar as variáveis de sandbox após disponibilizar e testar este código.
4. Na tela /admin/mp-primary-1n, criar o consentimento de teste com x-test-status ACTIVE e x-test-token true.
5. Configurar o receiver_id retornado, criar Order PIX com owner/partner e consultar status, amounts e splits na Orders API.
6. Integrar o checkout comercial transparente, tokenização MercadoPago.js para cartão, 3DS, UX, webhooks, cancelamentos, reembolsos, auditoria e conciliação de pagamentos. Migrar os dados financeiros antes de liberar pedidos ao público.

Nenhum pagamento deve ser marcado como aprovado apenas porque a API criou uma Order. A ordem final requer status processed/accredited e reconciliação oficial. Os valores são brutos e as tarifas do Mercado Pago precisam ser tratadas na contabilidade.

Documentação do fluxo antigo 1:1:
https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
