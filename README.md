# VELLOR MENSWEAR

Loja de moda masculina com **Next.js 15 / React 19**, **Vercel** e **Neon PostgreSQL**.

## Pagamentos: Asaas Sandbox

O provedor ativo do novo checkout é o **Asaas**. O antigo fluxo Mercado Pago/OAuth foi retirado do código de aplicação. O histórico financeiro já gravado no banco é mantido para auditoria.

A VELLOR é **vendedora principal** e cobra o valor total em um **único Asaas Checkout** (Pix/cartão). Cada fornecedor possui conta Asaas e é identificado por `walletId`; sua parte é enviada via Split. O saldo líquido remanescente pertence à VELLOR. **Taxas Asaas não estão descontadas nos relatórios de resultado até conciliação.**

A integração está restrita ao Sandbox e **não habilita cobranças reais**. O checkout da loja fica fechado por padrão. Para liberar um comprador de teste, é necessário configurar **todos** `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_SANDBOX_TEST_CUSTOMER_EMAIL`, `ASAAS_CHECKOUT_ENABLED=true`, `SITE_URL`, `DATABASE_URL`. O Sandbox nunca é liberado ao público.

### Configuração e homologação

1. Na conta Asaas Sandbox principal, habilitar Split e gerar chave API.
2. Na Vercel, cadastrar `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3` e `ASAAS_API_KEY` (nunca colocar segredos no GitHub).
3. Criar `ASAAS_WEBHOOK_TOKEN` forte (mínimo 32 caracteres), configurar Webhook Asaas de eventos `CHECKOUT_CREATED`, `CHECKOUT_PAID`, `CHECKOUT_EXPIRED`, `CHECKOUT_CANCELED` apontando a `${SITE_URL}/api/webhooks/asaas` e utilizar o mesmo token de autenticação.
4. Abrir `/admin/fornecedores` com conta administrativa para aplicar a migração aditiva `006_asaas.sql`.
5. Abrir `/admin/asaas` com conta **super_admin** para validar autenticação, cadastrar `walletId` de cada fornecedor e criar um checkout diagnóstico de R$ 170 (fornecedor R$ 100).
6. Confirmar pagamento e Splits com eventos oficiais Asaas e conferir estoque, pedidos, taxas, duplicidade de notificações e cancelamentos antes de habilitar o teste ponta a ponta.
7. Manter `ASAAS_CHECKOUT_ENABLED=false` até a homologação e nunca usar chave de produção no código Sandbox.

**Atenção:** reembolsos com vários fornecedores exigem revisão administrativa. O sistema não inicia estorno automático parcial antes de homologar o procedimento Asaas. Os registros históricos das migrações antigas são mantidos, mas não há endpoints de pagamento nem telas de conexão do provedor anterior.

## Páginas

- `/`: vitrine e carrinho.
- `/conta`: clientes.
- `/admin`: administração geral.
- `/admin/fornecedores`: convites e anúncios.
- `/admin/financeiro`: gestão financeira.
- `/admin/asaas`: diagnóstico e Split Sandbox.
- `/fornecedor`: anúncios, estoque, prazos e pedidos.
- `/finalizar`: resumo de compra e endereço.
- `/pagamento/grupos`: acompanhamento do pagamento e pedidos derivados.

## Desenvolvimento

```bash
npm install
npm test
npm run build
```

A migração preserva os 104 SKUs originais, o visual aprovado, a reserva gerencial de 20% e o controle de preços por administrador. O acréscimo de 70% é apenas referência, nunca mínimo obrigatório.

Não compartilhar API Keys ou credenciais do Neon. Antes de aprovar deploy definitivo, revisar migrações e ter backup do banco.
