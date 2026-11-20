-- Mercado Pago Split 1:1: tentativa de pagamento não é pedido.
-- Mantém compatibilidade com pedidos e grupos anteriores.
ALTER TABLE supplier_order_groups ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE supplier_order_groups ADD COLUMN IF NOT EXISTS checkout_batch_id uuid;
ALTER TABLE supplier_order_groups ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES users(id);
ALTER TABLE supplier_order_groups ADD COLUMN IF NOT EXISTS recipient_snapshot jsonb;
ALTER TABLE supplier_order_groups ADD COLUMN IF NOT EXISTS items_snapshot jsonb;
ALTER TABLE supplier_order_groups ADD COLUMN IF NOT EXISTS subtotal_cents int;
ALTER TABLE supplier_order_groups ADD COLUMN IF NOT EXISTS discount_cents int;
ALTER TABLE supplier_order_groups ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES coupons(id);
ALTER TABLE supplier_order_groups ADD COLUMN IF NOT EXISTS coupon_code_snapshot text;
ALTER TABLE supplier_order_groups ADD COLUMN IF NOT EXISTS checkout_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS supplier_group_checkout_batch_idx ON supplier_order_groups(checkout_batch_id,customer_id);
CREATE INDEX IF NOT EXISTS supplier_group_customer_idx ON supplier_order_groups(customer_id,created_at DESC);
-- Cupom de carrinho multifornnecedor é contabilizado uma só vez, no primeiro pagamento aprovado.
CREATE TABLE IF NOT EXISTS checkout_coupon_redemptions (
 checkout_batch_id uuid PRIMARY KEY,
 coupon_id uuid NOT NULL REFERENCES coupons(id),
 order_id uuid NOT NULL REFERENCES orders(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
