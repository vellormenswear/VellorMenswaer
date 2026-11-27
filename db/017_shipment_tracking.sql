CREATE TABLE IF NOT EXISTS shipment_tracking_cache (
 group_id uuid PRIMARY KEY REFERENCES supplier_order_groups(id) ON DELETE CASCADE,
 tracking_code text NOT NULL,
 snapshot jsonb,
 fetched_at timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 attempt_token uuid,
 error_code text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shipment_tracking_usage (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shipment_tracking_usage_attempted_idx ON shipment_tracking_usage(attempted_at);
