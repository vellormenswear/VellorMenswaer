# Vellor Menswear — Correções da vitrine para Vercel

A versão aprovada de HTML e CSS continua a base visual. O layout HTML aprovado foi preservado em `public/vitrine.html`. Os scripts legados de prévia não são incluídos no pacote.

## Corrigido

- Eliminados da vitrine e do JavaScript público: cupom DEMO10, pedidos fictícios armazenados no navegador, notificação falsa "Novo pedido pago", painel ADM falso e avisos de apresentação/demonstração.
- Carrinho usa os produtos do catálogo nacional e orçamento do servidor. Cupons, preços, frete, pedidos e acesso administrativo são controlados por Neon/APIs, nunca por validação apenas no navegador.
- Não são exibidos anúncios sem fotografia verificada ou sem preço. Permanecem no arquivo nacional e no banco para que a equipe possa cadastrá-los posteriormente.
- Checkout bloqueado por padrão, com `STORE_OPEN_FOR_ORDERS=false`. O projeto mantém a integração sandbox para testes controlados, mas não realiza cobranças reais.
- Melhorado o comportamento de toque e colunas no celular, preservando as cores, tipografia, fotos e composição do layout aprovado.

## Fotos e estoque de conteúdo

- 104 SKUs nacionais registrados no catálogo.
- 91 fotografias principais individuais originais válidas; mais 13 anúncios vinculados a imagens originais da galeria como referência de cores.
- 101 SKUs com fotografia (incluindo fotos de referência de cores quando a oferta é menor que o kit fotografado) e preço, elegíveis à vitrine.
- 13 SKUs Dry Fit de 1/2 peças vinculados a fotografias originais de kits de quatro apenas como referência de cores. O site informa expressamente que a fotografia mostra 4 peças, enquanto a oferta contém 1 ou 2.
- 3 SKUs BINBOND B1885 com foto, mas sem preço.

3 SKUs sem preço permanecem não publicáveis. As 13 ofertas Dry Fit foram vinculadas a fotografias existentes no Drive, com nota de referência de quantidade; confirmar viabilidade de fracionamento do kit do fornecedor antes de aceitar pedidos reais.

## Condições de implantação

1. Configure `DATABASE_URL`, `SITE_URL` e os demais serviços em `.env.example` usando credenciais seguras na Vercel.
2. Rode `npm install`, `npm run db:migrate`, `npm run db:seed` e `npm run admin:bootstrap` em um ambiente seguro.
3. Mantenha `STORE_OPEN_FOR_ORDERS=false` até confirmar a autorização e configuração de cobrança; a integração atual não permite produção.
4. Teste banco, autenticação, cupons, pedidos, webhooks e responsividade antes de usar comercialmente.

**Validação efetuada neste pacote:** seis testes unitários aprovados e integridade dos arquivos. Não foi possível compilar Next.js porque a instalação das dependências via npm expirou no ambiente de execução. O banco Neon e o Mercado Pago ainda não foram testados ponta a ponta.

## Itens usando foto original como referência de cores (não são fotos individuais/duplas exatas)

- `CAMISETA-DRYFIT-1UN-BRANCA` — Camiseta Dry Fit Masculina — 1 Unidade
- `CAMISETA-DRYFIT-1UN-CINZA` — Camiseta Dry Fit Masculina — 1 Unidade
- `CAMISETA-DRYFIT-1UN-MARINHO` — Camiseta Dry Fit Masculina — 1 Unidade
- `CAMISETA-DRYFIT-2UN-2PRETAS` — Kit 2 Camisetas Dry Fit Masculinas
- `CAMISETA-DRYFIT-2UN-2BRANCAS` — Kit 2 Camisetas Dry Fit Masculinas
- `CAMISETA-DRYFIT-2UN-2CINZAS` — Kit 2 Camisetas Dry Fit Masculinas
- `CAMISETA-DRYFIT-2UN-2MARINHO` — Kit 2 Camisetas Dry Fit Masculinas
- `CAMISETA-DRYFIT-2UN-PRETA-BRANCA` — Kit 2 Camisetas Dry Fit Masculinas
- `CAMISETA-DRYFIT-2UN-PRETA-CINZA` — Kit 2 Camisetas Dry Fit Masculinas
- `CAMISETA-DRYFIT-2UN-PRETA-MARINHO` — Kit 2 Camisetas Dry Fit Masculinas
- `CAMISETA-DRYFIT-2UN-BRANCA-CINZA` — Kit 2 Camisetas Dry Fit Masculinas
- `CAMISETA-DRYFIT-2UN-BRANCA-MARINHO` — Kit 2 Camisetas Dry Fit Masculinas
- `CAMISETA-DRYFIT-2UN-CINZA-MARINHO` — Kit 2 Camisetas Dry Fit Masculinas

## Itens sem preço

- `BINBOND-B1885-01` — BINBOND B1885 (Patek Philippe Nautilus)
- `BINBOND-B1885-02` — BINBOND B1885 (Patek Philippe Nautilus)
- `BINBOND-B1885-03` — BINBOND B1885 (Patek Philippe Nautilus)


### Versão 19/11 — Inicialização automática dos painéis
- As migrações 002 e 003 são aplicadas no primeiro acesso autenticado aos painéis por POST protegido.
- Em caso de erro, a transação é revertida; consultar a mensagem do painel e os logs de Vercel.
- A migração base 001 exige inspeção caso não exista; preservamos os dados existentes.
