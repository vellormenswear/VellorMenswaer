CREATE TABLE IF NOT EXISTS store_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 theme text NOT NULL CHECK(theme IN ('reveillon','carnaval','pascoa','maes','namorados','pais','halloween','blackfriday','natal','custom')),
 headline text NOT NULL DEFAULT '', message text NOT NULL DEFAULT '',
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 enabled boolean NOT NULL DEFAULT false, decoration boolean NOT NULL DEFAULT true,
 intensity text NOT NULL DEFAULT 'discreta' CHECK(intensity IN ('discreta','moderada','festiva')),
 store_bps integer NOT NULL DEFAULT 0 CHECK(store_bps BETWEEN 0 AND 9999),
 product_discounts jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(product_discounts)='object'),
 pix_bps integer NOT NULL DEFAULT 0 CHECK(pix_bps BETWEEN 0 AND 9999),
 pix_product_discounts jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(pix_product_discounts)='object'),
 pix_accumulate boolean NOT NULL DEFAULT false,
 created_by uuid REFERENCES users(id), updated_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_campaigns_active_idx ON store_campaigns(starts_at,ends_at) WHERE enabled;
CREATE TABLE IF NOT EXISTS campaign_reminder_decisions (
 user_id uuid NOT NULL REFERENCES users(id), theme text NOT NULL, event_year integer NOT NULL,
 decision text NOT NULL CHECK(decision IN ('later','ignore')), stage text NOT NULL CHECK(stage IN ('month','week')),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,theme,event_year)
);
