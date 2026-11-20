# VELLOR MENSWEAR

Loja de moda masculina em **Next.js 15 / React 19**, deploy na **Vercel**, banco **Neon PostgreSQL** e integração em desenvolvimento com **Mercado Pago Split 1:1**.

**Este repositório é a base de trabalho em equipe.** Não está homologado para produção comercial; checkout real permanece desabilitado por padrão. A implantação na Vercel é separada do versionamento Git.

## Começar

```bash
npm install
cp .env.example .env.local
npm run dev
```

No Windows, copie `.env.example` manualmente para `.env.local`. Configure as variáveis **localmente** com credenciais fornecidas pelos administradores, sem colocá-las em commits, issues ou mensagens. `npm run test` valida as regras sem dados de produção.

```bash
npm test
```

### Rotas e componentes principais

- `/` — vitrine com a identidade VELLOR (verde-esmeralda/champanhe), catálogo, carrinho e favicon VL.
- `/conta` — acesso do consumidor.
- `/admin` — administração geral.
- `/admin/fornecedores` — convites, revisão de anúncios, preços e alertas.
- `/admin/financeiro` — faturamento, resultados e reserva gerencial.
- `/fornecedor/cadastro?token=...` — cadastro por convite exclusivo.
- `/fornecedor` — anúncios, estoque, pedidos, remessas e conexão Mercado Pago.
- `/finalizar` e `/pagamento/grupos` — checkout por grupo/fornecedor (em testes).

### Documentação

- [`README_MARKETPLACE_VELLOR.md`](README_MARKETPLACE_VELLOR.md) — regras, migração Neon e Split.
- [`docs/ESTADO_E_PRIORIDADES.md`](docs/ESTADO_E_PRIORIDADES.md) — funcionalidades entregues e pendências críticas.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — fluxo para dois desenvolvedores.
- [`.env.example`](.env.example) — **exemplo com espaços em branco**, nunca inserir valores reais.
- [`README_HISTORICO.md`](README_HISTORICO.md) — histórico de entregas e notas anteriores; algumas informações são legadas.

## Segurança e implantação

- Não compartilhe `DATABASE_URL`, tokens do Mercado Pago, segredos OAuth, chaves de criptografia ou valores do `.env.local`.
- Migrações automáticas do marketplace estão previstas para a abertura administrativa. **Antes de abrir no banco de produção, fazer backup e testar numa branch de desenvolvimento do Neon.**
- Os 104 SKUs históricos são preservados; os anúncios precisam ser associados aos fornecedores antes de receber Split.
- Os preços de venda são definidos livremente pelo administrador. **70% de acréscimo é referência comercial, não bloqueio obrigatório**.
- A reserva de segurança é de **20% do lucro positivo apurado**, como registro gerencial; não é uma retenção bancária.
- Fornecedor pode escolher estoque por quantidade ou disponibilidade e controlar prazos, com monitoramento de atrasos.
- Carrinhos com mais de um fornecedor geram grupos de pagamento separados. Cada grupo pago pode ser enviado independentemente.
- Cancelamento antes da postagem pede reembolso e notifica o admin; falhas devem ser conciliadas, sem marcar reembolso como concluído até confirmação oficial.

> O GitHub guarda **código e arquivos públicos do site**. Clientes, pedidos, dados pessoais e segredos ficam **apenas no banco de dados e nos serviços apropriados**, nunca versionados.
