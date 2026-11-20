# VELLOR — correções acumuladas, sem publicação
Data: 2026-11-20
Base: VELLOR_MENSWEAR_LOGIN_COMPRA_FONTES_NITIDAS_VERCEL_2026-11-20.zip

## Corrigido na cópia de trabalho (ainda NÃO publicado)

1. **Convites de fornecedor por link, sem enviar e-mail**
   - Retirado campo obrigatório de e-mail do painel de convites.
   - Botão cria token aleatório de uso único com prazo de 7 dias e opção de copiar URL.
   - O fornecedor preenche o e-mail no formulário de cadastro; links antigos vinculados a e-mail continuam aceitos.
   - Banco mantém coluna email NOT NULL usando string vazia para convites livres (sem migração destrutiva).
   - Não há chamada de API de envio de e-mail no fluxo.
2. **Compra de visitante direciona a login/cadastro**
   - Finalizar compra / Comprar agora verifica autenticação antes de encaminhar ao checkout.
   - Se sessão ausente ou verificação falhar, abre /conta?next=%2Ffinalizar (antes do checkout).
   - /finalizar exige sessão do cliente e não exibe aviso de pagamentos antes da verificação.
   - Carrinho permanece em localStorage durante o login/cadastro e é retomado após autenticação.

## Validações locais
- `npm test`: 32 testes automatizados aprovados.
- `node --check` nos módulos JS modificados: aprovado.
- Sintaxe JSX de páginas alteradas: aprovada pela análise sintática do TypeScript.
- Ainda não houve publicação nem teste funcional contra banco/serviço Vercel de produção.

## Pendente
- Receber demais problemas relatados pelo usuário; acumular ajustes nesta pasta.
- Criar ZIP completo **somente quando o usuário solicitar**.
