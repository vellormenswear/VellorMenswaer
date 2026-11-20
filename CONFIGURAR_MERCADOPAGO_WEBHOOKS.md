# VELLOR — Mercado Pago Split 1:1 e Webhooks

## Regra de negócio

- `checkout-create` grava somente uma intenção de pagamento: grupos de fornecedores com endereços, itens, valores e reservas lógicas de estoque (vencimento em 2 horas). **Não grava pedidos em `orders`.**
- Para cada fornecedor vinculado por OAuth, é criada uma preferência do Mercado Pago com `marketplace_fee` e `external_reference` igual ao ID do grupo. O cliente segue os links separados de pagamento.
- Após receber um Webhook `payment`, o backend valida `x-signature`, confere o ambiente, consulta `/v1/payments/{id}` com o token OAuth do fornecedor e compara ID do grupo, vendedor, moeda, valor e comissão.
- **Somente o status `approved` consultado no Mercado Pago** dispara a criação transacional do pedido, seus itens e registro do pagamento. Eventos duplicados não devem criar pedido duplicado.
- Pagamentos pendentes/rejeitados não geram pedidos; vários fornecedores do mesmo carrinho podem ser pagos e enviados independentemente.
- Se um pagamento tardio for aprovado quando o estoque já não atende, é criado pedido marcado para cancelamento e reembolso, sem liberar envio; o administrador precisa tratar a pendência.
- Cupom de carrinho multifornnecedor conta uma única utilização na primeira aprovação.
- Pedidos antigos não são apagados nem reestruturados; a migração 004 mantém compatibilidade.

## 1. Criar/configurar uma aplicação Marketplace no Mercado Pago

Abra o painel do Mercado Pago Developers, crie ou selecione a aplicação de **Split de Pagamentos 1:1** com **Checkout Pro**. A aplicação de marketplace deve permitir a autorização OAuth dos fornecedores. A VELLOR usa a credencial OAuth de cada fornecedor, não uma conta central para receber a parte do fornecedor.

Defina a Redirect URL OAuth exatamente como:

`https://SEU-DOMINIO/api/marketplace/oauth-callback`

Cada fornecedor deverá entrar na sua conta VELLOR e clicar em **Conectar Mercado Pago**. Somente fornecedores com conta vinculada e anúncio aprovado podem vender no Split.

## 2. Configurar Webhooks

No painel Mercado Pago Developers, acesse **Suas integrações → aplicação → Webhooks → Configurar notificações**. Configure a URL HTTPS:

`https://SEU-DOMINIO/api/webhooks/mercadopago`

Selecione o evento **Pagamentos (`payment`)** no ambiente correto. O site também inclui `notification_url` com um identificador de grupo em cada preferência para localizar com segurança a conta OAuth do fornecedor. **Não use IPN no lugar de Webhooks**. Copie a chave secreta de assinatura dos Webhooks para `MP_WEBHOOK_SECRET` na Vercel; a chave é privada e não deve constar do repositório.

Fluxo: Mercado Pago `POST webhook` → valida HMAC (`x-signature`, `x-request-id`, `data.id`) → busca pagamento na API do Mercado Pago → valida valores/fornecedor → cria o pedido somente com `approved`.

A URL de retorno do navegador não confirma o pagamento e não cria o pedido.

## 3. Variáveis no projeto Vercel

Em **Vercel → Project → Settings → Environment Variables**, configure os valores privados diretamente (nunca no ZIP):

- `DATABASE_URL`: conexão segura com Neon.
- `SITE_URL`: URL HTTPS pública e exata, sem barra final.
- `MP_CLIENT_ID`: Client ID da aplicação Mercado Pago.
- `MP_CLIENT_SECRET`: Client Secret da aplicação.
- `MP_OAUTH_REDIRECT_URI`: `${SITE_URL}/api/marketplace/oauth-callback` (substitua por URL concreta, não use interpolação na Vercel).
- `MP_WEBHOOK_SECRET`: chave da assinatura dos Webhooks do ambiente correto.
- `MP_TOKEN_ENCRYPTION_KEY`: chave AES-256-GCM de 32 bytes em hexadecimal (64 caracteres), para criptografar tokens OAuth de fornecedores no Neon. Não a altere depois de vincular fornecedores sem planejar a rotação.
- `MP_MODE=sandbox` para testes (troque para `production` somente na liberação).
- `MP_SPLIT_ENABLED=true` quando a integração de split estiver validada.
- `STORE_OPEN_FOR_ORDERS=true` para abrir o checkout após os testes.
- `MP_LIVE_ENABLED=false` até validar tudo; para produção real, além de `MP_MODE=production`, exige `MP_LIVE_ENABLED=true`.

O modo de teste/produção continua bloqueado quando as variáveis obrigatórias estiverem ausentes. O webhook não precisa da sessão do navegador. As credenciais permanecem do lado do servidor.

## 4. Migrar o Neon

A migração `db/004_paid_orders_only.sql` deve ser aplicada antes de permitir checkout. Após publicar e configurar o `DATABASE_URL`, entre como administrador no painel de Fornecedores ou Financeiro: a inicialização automática autenticada executa as migrações pendentes (incluindo 004), sem excluir pedidos existentes. Se preferir realizar manualmente, rode `npm run db:migrate` em um terminal confiável com acesso ao Neon.

Não publique com `STORE_OPEN_FOR_ORDERS=true` antes da migração e dos testes de homologação.

## 5. Roteiro de testes no ambiente de teste

1. Faça login com uma conta Cliente e cadastre o endereço; visitantes não podem iniciar checkout.
2. Conecte um fornecedor de teste via OAuth; aprove um anúncio com preço e custo válidos.
3. Abra checkout: verifique que a lista de pedidos continua vazia, pois existe apenas intenção de pagamento.
4. Execute um pagamento de teste aprovado: aguarde o webhook e consulte os pedidos. Deve surgir **um único pedido pago** vinculado ao fornecedor.
5. Reenvie a mesma notificação assinada de teste: não pode duplicar o pedido, estoque, cupom ou receita.
6. Execute cobrança pendente/rejeitada: não pode criar pedido.
7. Teste carrinho com dois fornecedores: pagamento de somente um cria somente seu pedido, com o segundo ainda aguardando.
8. Confirme valor/identidade da conta recebedora, estoque, envio e reembolso usando conta de teste.
9. Confira o histórico de eventos e respostas no painel Webhooks do Mercado Pago e os logs da Vercel.

**Estado de entrega:** código integrado e testes automatizados locais aprovados; credenciais reais, migração no Neon, Webhook cadastrado no Mercado Pago, build na Vercel e pagamentos de ponta a ponta ainda não foram executados neste ambiente. Não liberar vendas reais antes desses passos.

## Atenção à remuneração dos fornecedores

A documentação do Mercado Pago informa que as tarifas da plataforma são descontadas da parcela do vendedor antes da comissão do marketplace. O custo cadastrado na VELLOR não equivale necessariamente ao valor líquido que o fornecedor receberá após as tarifas. Isso precisa ser considerado nas condições comerciais.
