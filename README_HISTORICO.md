> **IMPORTANTE:** esta versão adicionou fornecedores + Split 1:1. Leia primeiro `README_MARKETPLACE_VELLOR.md`; trechos antigos deste README sobre Orders API e frete fixo são históricos.

# Vellor Menswear — loja Next.js / Vercel / Neon / Mercado Pago (sandbox)

**Projeto real de aplicação, para configuração e testes.** A vitrine é derivada do último HTML aprovado, preservando a identidade visual verde-esmeralda/dourado, o logotipo horizontal Vellor Menswear, as fontes, proporções e os layouts desktop/mobile. Não é uma troca por um tema diferente.

## Estado entregue

- **104 anúncios de envio nacional**, agrupados conforme o catálogo nacional aprovado (35 modelos). O seed usa somente `data/catalogo-nacional.json`, com os nomes, SKUs, tamanhos, preços, imagens e observações documentadas; variantes de origem internacional ou não confirmada não são importadas.
- **91 fotos por SKU preservadas byte a byte**, extraídas do HTML aprovado em `/public/product-images/`, **28 fotos adicionais originais** em `/public/gallery/` e **13 capturas originais** das camisetas Dry Fit separadas em `/public/gallery/camisetas-dryfit-originais/` para revisão. O layout aprovado está preservado na vitrine em `public/vitrine.html`; a cópia histórica do HTML com pedidos fictícios não é incluída neste ZIP para impedir reutilização acidental.
- **104 anúncios nacionais cadastrados, sendo 101 com preço e imagem associados** e **3 variações BINBOND B1885 sem preço, bloqueadas para venda**. Os 13 anúncios Dry Fit de 1 ou 2 unidades sem foto individual própria usam **fotografias originais de kits de 4 unidades apenas como referência visual das cores**, sem alterar a imagem original. Cada anúncio identifica expressamente a quantidade de peças vendida e avisa quando a foto exibe 4 unidades. As 13 imagens originais da galeria permanecem preservadas. A composição exata dos kits de 1/2 unidades e os tamanhos devem ser confirmados com o fornecedor antes de operações comerciais.
- `public/vitrine.html` mantém o desenho visual e CSS da versão aprovada. O código legado de pedidos fictícios e cupom fictício foi eliminado. Imagens embutidas foram movidas para URLs estáticas, com **os mesmos bytes**, reduzindo o HTML de ~2,6 MB para ~90 KB e melhorando a navegação móvel.
- Portal `/conta`: cadastro público exclusivamente cliente, autenticação, logout, recuperação de senha por link (Resend), perfil, telefone, endereços com ViaCEP, histórico, rastreamento, cancelamento/devolução como solicitação.
- Portal `/admin`: visão geral, notificações, pedidos, expedição, produtos/SKUs/preços/fotos/estoque, cupons, clientes, solicitações, equipe, permissões, configurações comerciais, relatórios exportáveis e auditoria.
- API no servidor com autorização por função/permissão. Hash de senha scrypt, cookies HttpOnly + Secure (produção), SameSite=Lax, proteção básica de CSRF/origem, sessões com tokens aleatórios armazenados apenas em hash, bloqueio de tentativas repetidas, expiração de reset e auditoria administrativa.
- Banco **Neon PostgreSQL** com migrações SQL, importação idempotente, snapshots dos itens e endereços no momento do pedido, pedidos/itens/pagamentos/cupom/histórico/notificações.
- **Mercado Pago Checkout Pro pela API de Orders**, exclusivamente com credenciais de teste. Criação POST `/v1/orders` no backend, X-Idempotency-Key, URLs de retorno, Webhook validado via HMAC SHA256 com janela de tempo, busca autenticada GET `/v1/orders/{id}`; apenas confirmação do provedor com **valor exato** marca pedido como pago. Replays não duplicam notificações. Não armazena cartão nem CVV.
- Ações administrativas usam API/banco; não são botões meramente ilustrativos. Upload de imagens usa Vercel Blob quando credencial configurada. Exclusão de imagem desvincula registro, preservando arquivos originais.

## Antes de instalar na Vercel

1. Crie um **projeto Neon PostgreSQL** e copie a string de conexão **pooled/SSL**. Nenhuma credencial está neste ZIP.
2. Extraia a pasta, faça upload do código para um repositório privado GitHub ou use Vercel CLI. Na Vercel, escolha **Next.js** e a raiz do projeto.
3. Defina em **Project → Settings → Environment Variables**:
   - `DATABASE_URL`: conexão Neon (`sslmode=require`).
   - `SITE_URL`: URL real `https://seu-projeto.vercel.app`, sem barra ao final.
   - `MP_MODE=sandbox`.
   - `STORE_OPEN_FOR_ORDERS=false` (padrão; não autoriza compras). Somente altere para `true` em ambiente controlado, após testes completos.
   - `MP_TEST_ACCESS_TOKEN`: token **de teste** do Mercado Pago, começando por `TEST-`.
   - `MP_WEBHOOK_SECRET`: assinatura secreta da integração **de testes**.
   - `RESEND_API_KEY` e `EMAIL_FROM` para recuperar senhas por e-mail; o remetente deve usar domínio validado no Resend.
   - `BLOB_READ_WRITE_TOKEN` para upload de fotos pelo painel (crie um Blob Store na Vercel).
4. Execute as migrações e o seed (no computador local ou ambiente controlado) apontando para a **mesma** URL Neon:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```

5. Crie o **primeiro Super Administrador**, uma única vez, a partir de um terminal confiável, **sem gravar a senha no código ou na Vercel**. Defina `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` apenas no ambiente do processo. A senha deve ter pelo menos 12 caracteres; o comando recusa execução se já existir Super Admin:

   ```bash
   # Exemplo Bash: read -s evita mostrar a senha enquanto ela é digitada
   export BOOTSTRAP_ADMIN_EMAIL='admin@seu-dominio.com'
   read -rsp 'Senha inicial segura: ' BOOTSTRAP_ADMIN_PASSWORD; echo
   export BOOTSTRAP_ADMIN_PASSWORD
   npm run admin:bootstrap
   unset BOOTSTRAP_ADMIN_PASSWORD
   ```

6. Faça o deploy. **URLs:** `/` para a vitrine, `/conta` para o cliente, `/admin` para equipe, `/finalizar` para checkout sandbox.
7. No Mercado Pago Developers, crie uma aplicação **Checkout Pro via Orders API** em ambiente **Teste**. Configure o Webhook `order` apontando para `https://seu-dominio/api/webhooks/mercadopago`. Guarde o secret apenas na Vercel. Teste com contas/compras de teste. **A URL de retorno nunca altera pagamentos**.
8. No `/admin` como Super Admin, defina um **frete fixo nacional** (pode ser zero somente quando oferecer frete grátis). O checkout fica bloqueado até o frete estar configurado.
9. Configure `RESEND_API_KEY` e `EMAIL_FROM` para habilitar envio real de links de recuperação de senha. Sem essas variáveis o endpoint retorna mensagem genérica, mas não consegue enviar e-mail.
10. Para cada nova conta Funcionário/Admin, o Super Admin cria a conta pelo painel e entrega a senha inicial por canal seguro. Toda conta criada pela página pública será **Cliente**.

## Comandos

```bash
npm install             # Dependências no computador ou Vercel
npm run dev             # Servidor local Next.js
npm run build           # Compilação de produção
npm run start           # Servir build
npm run db:migrate      # Aplicar SQL db/001_init.sql
npm run db:seed         # Importar 104 SKUs nacionais sem sobrescrever edições existentes
npm run admin:bootstrap # Primeiro Super Admin, usando variáveis temporárias
npm test                # Testes de segurança disponíveis
```

## Papéis e limites

| Papel | Escopo |
|---|---|
| Cliente | Perfil, endereços, carrinho, pedidos próprios, solicitações |
| Funcionário | Operações e consultas conforme permissões granulares `orders.read`, `orders.process`, `products.read` |
| Administrador | Painel, catálogo, fotos, cupons, relatórios, clientes e operações; **não** cria/rebaixa administradores nem altera tokens sensíveis |
| Super Administrador | Tudo isso, equipe/permissões, auditoria, configuração de frete e status de integração. Credenciais permanecem nas variáveis protegidas da plataforma |

**Importante:** a proteção é verificada em cada endpoint; ocultar menus é apenas interface. O projeto não coleta CPF nem dados de cartão. Endereços e telefones são dados pessoais: configure acesso privado ao Neon, backups, política de privacidade e retenção conforme LGPD antes de operar comercialmente.

## Webhooks e pagamentos — garantia de testes

O código da API se recusa a iniciar cobranças a menos que `MP_MODE=sandbox` **e** o token provenha de `MP_TEST_ACCESS_TOKEN` com prefixo `TEST-`. Não existe ativação de produção incluída. A tela de retorno mostra apenas aviso. Webhook exige `live_mode === false`, HMAC válido, consulta à Orders API, conferência da referência externa, moeda e total; então cria a notificação “Novo pedido pago!” com snapshot completo do pedido.

**Reembolsos:** o painel registra solicitações de atendimento; nenhuma ação manual pode falsificar um reembolso. O estado “reembolsado” deve vir de confirmação validada pela API do provedor. A efetivação financeira de reembolsos automáticos não é ativada neste pacote de testes.

## Política de publicação e pagamentos

- **Nenhuma cobrança real foi autorizada pelo lojista.** A aplicação não executa pagamentos em produção. Mantenha `STORE_OPEN_FOR_ORDERS=false` em qualquer implantação pública.
- O site não contém cupom DEMO10, painel de pedidos fictícios nem textos de apresentação simulada.
- O catálogo contém 104 registros nacionais. Dos 104, 101 têm preço e foto associada; 13 desses 101 usam fotografias originais de kits de 4 unidades como **referência de cores** para ofertas de 1/2 peças, acompanhadas do aviso da quantidade. As 3 variações BINBOND B1885 sem preço permanecem não publicáveis. Verifique a correspondência dos kits com o fornecedor antes de abrir as vendas.
- O checkout real só deve ser implementado/ativado após autorização explícita, credenciais operacionais, revisão jurídica/segurança e teste de integração.

## Observações de implantação e testes

O código e os arquivos de dependências foram preparados e os testes unitários de senha/assinatura HMAC foram executados. **O build real Next.js, a conexão Neon e a chamada ao Mercado Pago não puderam ser executados nesta sessão**, pois não havia `DATABASE_URL`, tokens de teste nem acesso ao registro npm no ambiente gerador. Portanto, **não declare a loja pronta para pagamentos** antes de executar `npm install`, `npm run build`, migrações e os testes integrados em sua Vercel.

O HTML original é usado como fonte visual; o catálogo nacional está em `data/catalogo-nacional.json`. Quando o Neon está configurado, `/api/catalog` atualiza os dados exibidos sem confiar em preços informados pelo navegador. Quando o Neon não está configurado, a vitrine ainda pode abrir como prévia, mas **nenhum pedido real é criado**.

### Referências oficiais

- Checkout Pro via Orders: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order
- URLs de retorno: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/web-integration/configure-back-urls
- Segurança de Webhooks: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications
- Vercel: https://vercel.com/docs/deployments
- Neon: https://neon.tech/docs/connect/connect-from-any-app

**Estoque e cupons:** a criação de pedidos de teste valida estoque conhecido e reserva temporariamente o limite de uso de cupom considerando pedidos pendentes recentes. Antes de ativar qualquer venda real, implemente confirmação e expiração transacional de reserva de estoque e verifique os webhooks com as credenciais da operação, além de realizar revisão independente de segurança e LGPD.


## Migração automática Neon (módulo Marketplace)

A partir desta versão, quando **administrador autenticado** abre `/admin/fornecedores` ou `/admin/financeiro`, o sistema executa `POST /api/admin/marketplace-status`: instala automaticamente **002 e 003 se pendentes**, com `schema_migrations` e lock transacional, usando a `DATABASE_URL` configurada no projeto Vercel. A migração base 001 e o seed não são executados automaticamente. Faça backup antes do primeiro acesso administrativo após publicar. Para falhas, veja `LEIA_ME_MIGRACAO_AUTOMATICA.txt`.
