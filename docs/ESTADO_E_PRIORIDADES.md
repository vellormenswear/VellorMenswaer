# VELLOR — Estado e prioridades

## Implementado em branch de migração

- Checkout Asaas Sandbox com cobrança principal VELLOR e Split fixo por carteira do fornecedor.
- Painel administrativo Asaas com diagnóstico de chave, carteira e teste isolado de R$ 170.
- API de checkout com verificação de sessão, comprador, estoque, endereço, custos e cupom.
- Webhook Asaas autenticado e reconciliação de pagamento com criação de pedidos após aprovação.
- Migração `006_asaas.sql` aditiva para carteiras, sessões e eventos; sem apagar históricos.
- Removidos do fluxo ativo: endpoints, OAuth, páginas de teste e bibliotecas de cobrança do provedor anterior.
- Mantidos catálogo, 104 SKUs, visual e portal de fornecedores.

## Próximas validações obrigatórias

1. Executar migração em banco Neon com backup.
2. Configurar `ASAAS_WEBHOOK_TOKEN` na Vercel e no Webhook Asaas.
3. Cadastrar ao menos um fornecedor Sandbox e verificar seu `walletId`.
4. Validar API real no sandbox, criar checkout teste e observar `CHECKOUT_PAID` e `PAYMENT_SPLIT_DONE`.
5. Conciliar taxas, estornos, cancelamentos e pagamentos tardios.
6. Só depois avaliar piloto; pagamentos reais não estão habilitados.

## Regras preservadas

VELLOR vendedora principal. O fornecedor recebe o custo contratado; a VELLOR mantém o saldo líquido após taxa. Preço e markup administrados livremente; reserva gerencial 20%; entregas por fornecedor e sem liberação de pedido sem pagamento oficial.
