# VELLOR MENSWEAR

Loja de moda masculina. Next.js 15, React 19, Vercel e Neon PostgreSQL.

## Operação

- A VELLOR recebe o pagamento integral pelo checkout oficial InfinitePay (Pix/cartões). O servidor consulta a confirmação oficial antes de criar o pedido.
- Clientes, ADM e Super ADM podem comprar. A validação de estoque, preço, cupom e endereço é a mesma para todos.
- Repasse manual via Pix ao fornecedor após conferência administrativa. Cada grupo pode avançar independentemente, sem divulgar a relação de fornecimento ao comprador.
- Cancelamento e estorno confirmado são operações distintas; comprovantes e histórico financeiro são preservados.
- Chamados possuem conversas persistentes. Alterações de tamanho antes da postagem mantêm o valor pago e exigem ciência do fornecedor.
- Catálogo e imagens de produtos vêm exclusivamente do banco; não existe catálogo de demonstração como alternativa à API.
- Credenciais de serviços ficam nas variáveis de ambiente da Vercel. Use .env.example como referência. Ative a cobrança somente após homologação: INFINITEPAY_CHECKOUT_ENABLED=true e STORE_OPEN_FOR_ORDERS=true. SITE_URL deve ser https://vellormenswear.com.br.

## Desenvolvimento
```sh
npm install
npm test
npm run build
```

Migrações SQL históricas permanecem versionadas, sem execução de pagamentos pelos provedores aposentados. Nunca apague registros financeiros para limpar o catálogo. Use backup e uma operação de manutenção específica, conferindo contas administrativas e pendências de pagamento.

Rotas administrativas: /admin, /admin/fornecedores, /admin/financeiro, /admin/infinitepay, /admin/atendimento. Rotas comerciais: /, /conta, /finalizar, /pagamento/grupos.
