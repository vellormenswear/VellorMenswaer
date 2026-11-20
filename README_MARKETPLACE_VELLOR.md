# VELLOR MENSWEAR — módulo Fornecedores + Marketplace

**Versão de desenvolvimento para Vercel / Neon, com cobranças reais desabilitadas.** Preserva o catálogo nacional (104 anúncios históricos), a identidade aprovada e o favicon VL. Não contém credenciais. As migrações 002 e 003 são aplicadas automaticamente, se necessárias, após login administrativo e abertura do painel, utilizando a DATABASE_URL já configurada.

## Páginas

- `/admin`: administração original; links para **Fornecedores** e **Gestão Financeira**.
- `/admin/fornecedores`: gerar e revogar links únicos de convite (7 dias), suspender fornecedores, aprovar anúncios e preços, analisar mudanças de preço, vincular manualmente os anúncios antigos, atrasos e reembolsos pendentes.
- `/admin/financeiro`: faturamento conciliado por grupos, comissão bruta, resultado após despesas/perdas e reserva gerencial de 20%, com registro auditável de despesas, perdas e recuperações.
- `/fornecedor/cadastro?token=...`: cadastro exclusivo por convite com senha forte.
- `/fornecedor`: anúncios/fotos/variações, custo de fornecimento (frete incluso), estoque por quantidade ou disponibilidade, atualização de prazo, pedidos pagos, postagem/rastreio, cancelamento antes do envio e vinculação Mercado Pago por OAuth.
- `/finalizar`: dados de entrega + orçamento do carrinho.
- `/pagamento/grupos?order_id=...`: links independentes por fornecedor, sem confundir o retorno do cliente com confirmação de pagamento.

## Princípios do marketplace

- Fornecedor informa **preço de fornecimento com frete incluído**, imagens, variações, SKU, quantidade/disponibilidade e prazos; não publica o preço ao consumidor.
- A administração aprova a publicação e define **livremente** os preços. O acréscimo de **70% é somente referência**, não mínimo obrigatório. Vendas com preço inferior ao custo do fornecedor ficam bloqueadas até correção porque não é possível criar comissão negativa no Split.
- Split 1:1: **um pagamento para cada fornecedor** com `marketplace_fee = total do grupo - custo do fornecedor` (após eventual desconto). O Mercado Pago aplica suas próprias tarifas à parcela do vendedor. Não há retenção garantida até a entrega.
- Cada grupo pago pode seguir independentemente; outro grupo pendente não impede a postagem.
- Estoque exato reservado no banco durante o checkout, com baixa atômica; para estoque preciso por tamanho, use SKU separado por tamanho. Estoques de disponibilidade simples não informam quantidade.
- Prazos são escolhidos pelo fornecedor e guardados no pedido; alterações posteriores não reescrevem a promessa de venda. Alerta de postagem usa dias úteis excluindo fins de semana, **não** feriados nacionais.
- Antes de postar, fornecedor pode cancelar automaticamente, acionando pedido de reembolso. **O status só será concluído depois da confirmação oficial**; falhas ficam visíveis ao administrador e podem ser reprocessadas.
- Reserva de segurança de **20% do lucro positivo registrado**, depois de despesas explicitamente lançadas, calculada de forma gerencial. Não representa segregação automática de dinheiro nem caução do Mercado Pago.

## Migração

1. Usar um **backup do banco Neon** e conferir a instância de destino.
2. Publicar o ZIP. Ao abrir `/admin/fornecedores` ou `/admin/financeiro` com sessão administrativa, a aplicação executa automaticamente as migrações 002 e 003 pendentes, via `POST /api/admin/marketplace-status`, na mesma `DATABASE_URL` do projeto. O comando `npm run db:migrate` continua disponível para manutenção manual, mas não é necessário para esses painéis.
3. Se o banco for novo, executar `npm run db:seed`, depois `npm run admin:bootstrap` com variáveis temporárias e senha forte. **Não** executar seed sem inspecionar previamente seu banco e seu propósito.
4. Publicar o ZIP na Vercel apontando para o mesmo Neon e `SITE_URL` correto. O domínio atual é configurado na Vercel, não pelo nome do ZIP.
5. Testar as interfaces e permissões com uma conta administrativa e uma conta de fornecedor.

## Configuração Mercado Pago Split 1:1

1. No Mercado Pago Developers, criar aplicação com **modelo Marketplace** e Checkout Pro (Preferências). Verificar os requisitos de conta e identificação do vendedor.
2. Registrar a URL **idêntica** a `${SITE_URL}/api/marketplace/oauth-callback` como redirect OAuth.
3. Variáveis protegidas na Vercel: `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI`, `MP_TOKEN_ENCRYPTION_KEY` (64 caracteres hex), `MP_WEBHOOK_SECRET`, `MP_MODE=sandbox`.
4. Configurar Webhook de **pagamentos** no endpoint `${SITE_URL}/api/webhooks/mercadopago`; o sistema valida `x-signature`, consulta `/v1/payments/{id}` com o token do fornecedor e confere referência, conta, moeda, valor e comissão.
5. Conectar as contas dos fornecedores via `/fornecedor`. Nunca compartilhar senhas nem inserir tokens no frontend.
6. Vincular os SKUs antigos aos fornecedores com custo individual. **Até isso acontecer, os 104 anúncios continuam no catálogo, mas a compra Split dos itens sem vínculo será bloqueada**. Também é necessário cadastrar fornecedores e autorizar suas contas.
7. Com todas as contas de teste prontas, testar pagamentos por fornecedor, cupons, rejeições, reembolsos, atrasos, duplicação de Webhooks e conciliação. Só depois colocar `MP_SPLIT_ENABLED=true` e `STORE_OPEN_FOR_ORDERS=true` **em ambiente controlado de testes**.

### Situação de lançamento (19/11/2026)

- A implementação de código e os testes unitários estão no ZIP. **Não foi possível instalar dependências e executar `next build` neste ambiente; testes ponta a ponta no Neon e na API do Mercado Pago não foram executados**.
- Não existe configuração real de OAuth/credenciais neste pacote. **Pagamentos reais permanecem desabilitados**, inclusive com `MP_MODE=production` (este código só permite iniciar split em sandbox).
- Preferências sem pagamento podem manter estoque reservado. Antes de operação comercial, é necessário implementar e homologar a reconciliação periódica e expiração segura das reservas, sem liberar estoque de pagamentos confirmados tardiamente.
- Fotos e anúncios de origem histórica exigem validação de fornecedor, estoque e preço antes de vendas. O checkout tradicional sem Split foi bloqueado para impedir cobrança com repasse incorreto.
- Obrigações fiscais, regras de devolução e tratamento de dados pessoais devem ser validados juridicamente antes do lançamento.

Referências oficiais: [integração Split 1:1](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace), [pré-requisitos](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/prerequisites), [autorização OAuth](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/additional-content/security/oauth/creation).
