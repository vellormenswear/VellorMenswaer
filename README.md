# VELLOR MENSWEAR

**Repositório oficial:** https://github.com/vellormenswear/VellorMenswaer

Loja de moda masculina em Next.js 15 e React 19, com PostgreSQL Neon, administração de fornecedores e estrutura de integração Mercado Pago Marketplace (Split 1:1).

## Estado atual

- Código-fonte e arquivos de configuração importados da branch de trabalho anterior (20/11/2026).
- Correção de estado do painel `/admin/fornecedores` incluída: `setChanges`, `setOverdue`, `setCancellations` e `setShipped`.
- **Imagens binárias da pasta `public/` ainda não foram importadas.** Os caminhos no catálogo e na galeria podem apontar para imagens inexistentes neste repositório.
- **Não vincular a produção da Vercel a este repositório até concluir a importação de imagens e os testes de homologação.** A versão atual da loja na Vercel não é alterada por esta importação.
- Checkout e Split exigem configuração e testes de sandbox; pagamentos reais não estão liberados nesta cópia.

## Desenvolvimento

```bash
npm install
npm test
npm run dev
```

Copie `.env.example` para `.env.local` e configure **somente localmente**, com credenciais administradas pela equipe. Nunca faça commit do `.env.local`.

## Telas

- `/`: catálogo e vitrine
- `/conta`: conta do consumidor
- `/admin`: administração
- `/admin/fornecedores`: revisão de fornecedores e anúncios
- `/admin/financeiro`: dados financeiros e margem gerencial
- `/fornecedor`: portal do fornecedor
- `/finalizar`: fluxo de checkout em homologação

## Colaboração

Use branches individuais, Pull Requests e testes. Antes de ligar a Vercel, conferir artefatos visuais, build, migrações Neon em ambiente de teste e configuração de variáveis.

Segredos, dados de clientes, pedidos e credenciais não devem ser colocados neste repositório público. Veja `CONTRIBUTING.md`, `README_MARKETPLACE_VELLOR.md` e `docs/ESTADO_E_PRIORIDADES.md`.
