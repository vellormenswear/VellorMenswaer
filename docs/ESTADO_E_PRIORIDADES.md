# Estado de desenvolvimento e pendências

Base: **VELLOR_MENSWEAR_PAINEL_FORNECEDORES_SETCHANGES_CORRIGIDO.zip**, revisão de 19/11/2026.

## Implementado no código (requer validação real)

- Identidade da VELLOR, logo VL/favicons, catálogo histórico de 104 anúncios.
- Cadastro de fornecedores via link individual; painel de fornecedor e análise administrativa de anúncios.
- Gestão financeira com reserva gerencial de 20% dos resultados positivos.
- Estrutura do checkout com pagamentos separados por fornecedor (Mercado Pago Split 1:1) e grupos de pedidos independentes.
- Migrações de fornecedores no Neon com mecanismo de atualização automática administrativa.
- Correção da tela de fornecedores: `setChanges`, `setOverdue`, `setCancellations` e `setShipped`.
- Remoção de menções promocionais a “envio nacional” do topo da vitrine.

## Pendências para homologação

1. Executar build Next.js e testes E2E em ambiente real de desenvolvimento.
2. Executar migrações 002/003 **em branch de testes Neon** e validar rollback/backups antes de produção.
3. Testar login/admin/convites, permissões, anúncios e baixa do estoque com dois usuários simultâneos.
4. Configurar OAuth de fornecedores, segredos do Mercado Pago, Webhook assinado e testar Split em sandbox.
5. Implementar/validar expiração e reconciliação de reservas para pagamentos tardios.
6. Validar reembolsos e pagamentos parciais em carrinhos com múltiplos fornecedores.
7. Revisar requisitos fiscais, contratos e tratamento LGPD antes da operação comercial.
8. Conectar este repositório à Vercel **somente depois** de conferir projeto, branch e variáveis; deploy automático não está configurado aqui.

## Regras comerciais acertadas

- O fornecedor informa o preço de fornecimento com frete já incluído.
- A VELLOR estabelece preço final livremente; 70% é só exemplo de markup.
- Mercado Pago aplica as tarifas segundo regras oficiais de Split; não há retenção garantida até a entrega.
- O fornecedor escolhe estoque por quantidades ou disponibilidade, informa seus prazos e rastreamento.
- Pedidos pagos de diferentes fornecedores são independentes.
- Cancelamentos de pedidos ainda não postados iniciam solicitação de reembolso e notificam a administração.
- Reserva de segurança: 20% do lucro efetivo positivo, gerencial.
- Envios nacionais, sem usar “envio nacional” como destaque publicitário.
