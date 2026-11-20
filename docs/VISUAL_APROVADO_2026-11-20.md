# VELLOR — visual aprovado — 20/11/2026

Fonte visual: VELLOR_PREVIA_MODERNA_CARRINHO_COMPLETO(2).html.

- Vitrine e carrinho estão em `public/vitrine.html`, CSS em `public/vellor-approved.css`, código em `public/vellor-approved.js`.
- Logo oficial centralizada; cabeçalho verde; categorias brancas; grade de modelos sem banners e sem o texto “coleção nacional”.
- Carrinho em seção própria (`/vitrine.html#carrinho`), com preço unitário, quantidade, valor da linha e prazo de entrega proveniente do fornecedor.
- Catálogo inicial de contingência embutido é derivado da versão em Drive, sem prazos inventados. Quando `/api/catalog` responde, o banco de dados passa a determinar integralmente o catálogo visível e prazos.
- Chave do carrinho: `localStorage['goston-cart-preview']`, compatível com `app/finalizar/page.jsx`.
- Cupom: `sessionStorage['pg-goston-cupom']`; totais reais consultados em `/api/checkout/quote`.
- Finalização abre `/finalizar`, que usa pagamentos independentes por fornecedor.
- Painéis administrativos, conta, APIs, integrações, Neon e Mercado Pago permaneceram inalterados.

Na Vercel, fazer deploy do diretório raiz, Framework Next.js, preservando variáveis de ambiente já configuradas no projeto.
