-- Apenas leitura. Execute no SQL Editor do banco Neon associado à VELLOR.
SELECT
  current_database() AS banco,
  to_regclass('public.users') IS NOT NULL AS usuarios_base,
  to_regclass('public.suppliers') IS NOT NULL AS fornecedores,
  to_regclass('public.supplier_invites') IS NOT NULL AS convites,
  to_regclass('public.supplier_submissions') IS NOT NULL AS anuncios_fornecedores,
  to_regclass('public.supplier_price_requests') IS NOT NULL AS solicitacoes_preco,
  to_regclass('public.supplier_order_groups') IS NOT NULL AS grupos_de_pedido,
  to_regclass('public.finance_adjustments') IS NOT NULL AS financeiro;
-- O endpoint /api/admin/marketplace-status verifica também o histórico das migrações.
