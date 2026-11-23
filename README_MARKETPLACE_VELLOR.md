# VELLOR — Fornecedores e Split Asaas

O checkout atualizado utiliza **Asaas Sandbox** e um pagamento único por carrinho. A VELLOR cobra diretamente e informa a distribuição fixa para cada fornecedor usando `walletId`.

## Regras do marketplace

- O fornecedor informa custo de fornecimento com frete, estoque por quantidade ou disponibilidade e prazos de entrega.
- A VELLOR aprova cada anúncio e define o preço ao cliente livremente; o markup de 70% é exemplo, não obrigação.
- O Split transfere para os fornecedores o valor fixo informado. O saldo líquido depois dos Splits e taxas permanece na VELLOR.
- Um carrinho multifornnecedor gera um Checkout Asaas e grupos internos de processamento de cada pedido.
- Um pedido só é criado depois de a VELLOR consultar a API oficial e verificar pagamento, valor e sessão de checkout. O Webhook autenticado é o gatilho principal; retorno visual não comprova pagamento.
- O estoque é reservado para evitar corridas de compra e baixado em transação no recebimento.
- Fornecedores podem preparar e entregar partes independentes do pedido depois de aprovado.
- Cancelamentos antes de enviar são registrados, mas reembolsos exigem conciliação administrativa; não há estorno parcial automático enquanto a integração não for homologada.

## Implantação

1. Banco Neon: aplicar `006_asaas.sql` por migrador autenticado, preservando tabelas históricas.
2. Vercel: cadastrar `ASAAS_BASE_URL`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `SITE_URL` e `ASAAS_SANDBOX_TEST_CUSTOMER_EMAIL`.
3. Asaas Sandbox: ativar Split e criar Webhook com `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED` e `CHECKOUT_CREATED` em `/api/webhooks/asaas`.
4. Superadministrador: abrir `/admin/asaas` e vincular fornecedores às respectivas carteiras Asaas.
5. Validar um checkout de R$ 170 com Split de R$ 100, sem produzir pedido real.
6. Apenas depois da homologação configurar `ASAAS_CHECKOUT_ENABLED=true` para o e-mail de comprador de teste. **Não abrir checkout ao público enquanto estivermos no Sandbox**.

Documentação oficial: https://docs.asaas.com/docs/checkout-com-split-de-pagamento
