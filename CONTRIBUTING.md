# Colaboração no projeto VELLOR MENSWEAR

## Organização recomendada

- Repositório **público** e branch `main` estável, sem segredos nem informações de clientes.
- Uma branch por tarefa: `feat/fornecedor-cadastro`, `fix/painel-financeiro`, `feat/split-checkout`.
- Cada alteração entra via **Pull Request**, revisada por outro programador antes de mesclar na `main`.
- Nunca editar diretamente código de produção, banco Neon ou variáveis Vercel sem coordenação.
- Não alterar catálogo, preços, aparência aprovada ou regras comerciais sem autorização do responsável pelo projeto.

## Rotina de desenvolvimento

1. Atualizar a `main` e criar branch da tarefa.
2. Implementar mudança pequena e documentar impacto no banco e em pagamentos.
3. Executar `npm test` e, quando dependências/variáveis locais estiverem prontas, `npm run build`.
4. Abrir Pull Request descrevendo **o que mudou, como testar e riscos de migração**.
5. Não publicar pagamentos reais antes de homologar banco, OAuth Split, webhooks e reembolsos.

## Segurança

- Variáveis em `.env.local` ou no painel seguro da Vercel, nunca no Git.
- Nunca commitar dumps SQL de clientes, tokens, credenciais, dados de pedidos ou relatórios pessoais.
- Fotos de catálogo e arquivos de identidade visual sem dados pessoais podem ficar versionados.
- Se um segredo for exposto, revogue/rotacione, não apenas apague o commit.

## Acesso do segundo programador

Na página do repositório oficial: `Settings → Collaborators → Add people`; conceder permissão **Write** (sem necessidade de Admin). Habilitar proteção da branch `main`, revisão por PR e checks quando disponíveis.
