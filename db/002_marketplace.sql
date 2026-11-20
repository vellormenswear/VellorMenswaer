-- Migração não destrutiva: fornecedores, catálogo sob revisão, pedidos 1:1, conciliação e reserva gerencial.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('customer','employee','admin','super_admin','supplier'));
CREATE TABLE IF NOT EXISTS suppliers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(id),
 business_name text NOT NULL, document_number text NOT NULL, address_text text,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 default_stock_mode text NOT NULL DEFAULT 'quantity' CHECK(default_stock_mode IN ('quantity','availability')),
 preparation_days int NOT NULL DEFAULT 2 CHECK(preparation_days BETWEEN 0 AND 90),
 delivery_days_min int NOT NULL DEFAULT 5 CHECK(delivery_days_min BETWEEN 1 AND 120),
 delivery_days_max int NOT NULL DEFAULT 15 CHECK(delivery_days_max BETWEEN 1 AND 180),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT supplier_delivery_window CHECK(delivery_days_max>=delivery_days_min)
);
CREATE TABLE IF NOT EXISTS supplier_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, token_hash text UNIQUE NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL,
 used_at timestamptz, revoked_at timestamptz, used_by uuid REFERENCES users(id), created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supplier_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id uuid NOT NULL REFERENCES suppliers(id),
 product_id uuid REFERENCES products(id), name text NOT NULL, description text NOT NULL DEFAULT '',
 category_id uuid REFERENCES categories(id), variants jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 admin_note text, reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz,
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_submissions_queue ON supplier_submissions(status,created_at);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS supplier_cost_cents integer CHECK(supplier_cost_cents IS NULL OR supplier_cost_cents>=0);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS stock_mode text NOT NULL DEFAULT 'quantity' CHECK(stock_mode IN ('quantity','availability'));
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS supplier_available boolean NOT NULL DEFAULT true;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS preparation_days int CHECK(preparation_days BETWEEN 0 AND 90);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS delivery_days_min int CHECK(delivery_days_min BETWEEN 1 AND 120);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS delivery_days_max int CHECK(delivery_days_max BETWEEN 1 AND 180);
CREATE INDEX IF NOT EXISTS product_supplier_idx ON products(supplier_id);
CREATE TABLE IF NOT EXISTS supplier_oauth_states (
 state_hash text PRIMARY KEY, supplier_id uuid NOT NULL REFERENCES suppliers(id), expires_at timestamptz NOT NULL,
 consumed_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supplier_mp_connections (
 supplier_id uuid PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
 provider_user_id text, token_encrypted text NOT NULL, refresh_encrypted text,
 expires_at timestamptz NOT NULL, connected_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supplier_order_groups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id),
 supplier_id uuid NOT NULL REFERENCES suppliers(id),
 amount_cents int NOT NULL CHECK(amount_cents>0), supplier_amount_cents int NOT NULL CHECK(supplier_amount_cents>=0),
 marketplace_fee_cents int NOT NULL CHECK(marketplace_fee_cents>=0),
 mp_fee_cents int,
 payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','approved','rejected','refunded','refund_pending','refund_failed')),
 fulfillment_status text NOT NULL DEFAULT 'awaiting_payment' CHECK(fulfillment_status IN ('awaiting_payment','paid','preparing','shipped','delivered','cancel_requested','canceled')),
 preference_id text UNIQUE, checkout_url text,
 provider_payment_id text UNIQUE,
 tracking_code text, carrier text, canceled_reason text,
 preparation_days int NOT NULL DEFAULT 2, delivery_days_min int NOT NULL DEFAULT 5, delivery_days_max int NOT NULL DEFAULT 15,
 promised_at timestamptz, posted_at timestamptz, delivered_at timestamptz,
 paid_at timestamptz, refunded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz DEFAULT now(),
 UNIQUE(order_id,supplier_id), CHECK(marketplace_fee_cents<=amount_cents)
);
CREATE INDEX IF NOT EXISTS supplier_group_supplier ON supplier_order_groups(supplier_id,created_at DESC);
CREATE TABLE IF NOT EXISTS supplier_order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES supplier_order_groups(id) ON DELETE CASCADE,
 order_item_id uuid NOT NULL UNIQUE REFERENCES order_items(id), variant_id uuid REFERENCES product_variants(id),
 sku_snapshot text NOT NULL, size_snapshot text, quantity int NOT NULL CHECK(quantity>0),
 unit_cost_cents int NOT NULL CHECK(unit_cost_cents>=0), supplier_line_cents int NOT NULL CHECK(supplier_line_cents>=0)
);
CREATE TABLE IF NOT EXISTS supplier_stock_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES supplier_order_groups(id),
 variant_id uuid NOT NULL REFERENCES product_variants(id), quantity int NOT NULL CHECK(quantity>0),
 status text NOT NULL DEFAULT 'held' CHECK(status IN ('held','committed','released')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(group_id,variant_id)
);
CREATE TABLE IF NOT EXISTS supplier_payment_events (
 id text PRIMARY KEY, group_id uuid REFERENCES supplier_order_groups(id), provider_payment_id text,
 status text NOT NULL DEFAULT 'received', created_at timestamptz DEFAULT now(), processed_at timestamptz, error_message text
);
CREATE TABLE IF NOT EXISTS finance_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES supplier_order_groups(id),
 kind text NOT NULL CHECK(kind IN ('expense','loss','recovery')), amount_cents int NOT NULL CHECK(amount_cents>0),
 note text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supplier_cancel_events (
 group_id uuid PRIMARY KEY REFERENCES supplier_order_groups(id), provider_response jsonb,
 last_attempt_at timestamptz NOT NULL DEFAULT now(), error_message text
);
-- Existing catalog remains active but cannot be sold through split until supplier ownership + cost are set.
