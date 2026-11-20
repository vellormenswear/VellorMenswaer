CREATE TABLE IF NOT EXISTS supplier_price_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id uuid NOT NULL REFERENCES suppliers(id),
 variant_id uuid NOT NULL REFERENCES product_variants(id), requested_cost_cents int NOT NULL CHECK(requested_cost_cents>0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 note text, reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_one_pending_price_per_variant ON supplier_price_requests(variant_id) WHERE status='pending';
