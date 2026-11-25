-- Idempotência de checkout, preservando cobranças e pedidos anteriores.
CREATE TABLE IF NOT EXISTS checkout_attempts (
 customer_id uuid NOT NULL REFERENCES users(id),
 idempotency_key uuid NOT NULL,
 checkout_batch_id uuid NOT NULL UNIQUE,
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(customer_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS supplier_groups_coupon_pending_idx
 ON supplier_order_groups(coupon_id,checkout_expires_at,checkout_batch_id)
 WHERE payment_status='pending' AND order_id IS NULL;
