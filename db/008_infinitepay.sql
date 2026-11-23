-- InfinitePay, recebimento integral e repasse Pix manual após conferência administrativa.
-- Apenas adições e nova opção de status; mantém registros históricos Asaas.
ALTER TABLE supplier_order_groups DROP CONSTRAINT IF EXISTS supplier_order_groups_fulfillment_status_check;
ALTER TABLE supplier_order_groups ADD CONSTRAINT supplier_order_groups_fulfillment_status_check
 CHECK(fulfillment_status IN ('awaiting_payment','awaiting_payout','paid','preparing','shipped','delivered','cancel_requested','canceled'));
CREATE TABLE IF NOT EXISTS infinitepay_checkout_batches (
 checkout_batch_id uuid PRIMARY KEY,
 customer_id uuid NOT NULL REFERENCES users(id),
 order_nsu text UNIQUE NOT NULL,
 checkout_url text,
 total_cents integer NOT NULL CHECK(total_cents >= 100),
 supplier_cents integer NOT NULL CHECK(supplier_cents > 0 AND supplier_cents < total_cents),
 status text NOT NULL DEFAULT 'creating' CHECK(status IN ('creating','pending','approved','refunded','failed')),
 transaction_nsu text UNIQUE, invoice_slug text,
 payment_method text, receipt_url text,
 paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS infinitepay_batch_customer_idx ON infinitepay_checkout_batches(customer_id,created_at DESC);
CREATE TABLE IF NOT EXISTS infinitepay_webhook_events (
 event_key text PRIMARY KEY,
 order_nsu text NOT NULL, event_type text NOT NULL,
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','processed','requires_review','ignored')),
 created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
CREATE TABLE IF NOT EXISTS supplier_manual_payouts (
 group_id uuid PRIMARY KEY REFERENCES supplier_order_groups(id),
 supplier_id uuid NOT NULL REFERENCES suppliers(id),
 amount_cents integer NOT NULL CHECK(amount_cents>0),
 transfer_reference text UNIQUE NOT NULL,
 notes text, recorded_by uuid NOT NULL REFERENCES users(id),
 paid_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_manual_payouts_supplier_idx ON supplier_manual_payouts(supplier_id,paid_at DESC);
