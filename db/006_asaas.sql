-- Integração Asaas sem apagar pedidos ou histórico da integração anterior.
CREATE TABLE IF NOT EXISTS supplier_asaas_wallets (
 supplier_id uuid PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
 wallet_id uuid UNIQUE NOT NULL,
 verified_by uuid NOT NULL REFERENCES users(id),
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS asaas_checkout_batches (
 checkout_batch_id uuid PRIMARY KEY,
 customer_id uuid NOT NULL REFERENCES users(id),
 provider_checkout_id uuid UNIQUE NOT NULL,
 total_cents integer NOT NULL CHECK(total_cents>0),
 supplier_cents integer NOT NULL CHECK(supplier_cents>0 AND supplier_cents<total_cents),
 checkout_url text NOT NULL,
 provider_payment_id text UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','refunded','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asaas_batch_customer_idx ON asaas_checkout_batches(customer_id,created_at DESC);
CREATE TABLE IF NOT EXISTS asaas_webhook_events (
 id text PRIMARY KEY,
 event_type text NOT NULL,
 checkout_id uuid,
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','processed','ignored')),
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz
);

-- Novo provedor padrão para inserts futuros; o histórico permanece com seu provedor original.
ALTER TABLE payments ALTER COLUMN provider SET DEFAULT 'asaas';
