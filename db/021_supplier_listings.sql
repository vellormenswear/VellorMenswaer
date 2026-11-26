-- Anúncios de fornecedores: revisão, exclusão lógica e variações preservadas.
ALTER TABLE supplier_submissions DROP CONSTRAINT IF EXISTS supplier_submissions_status_check;
ALTER TABLE supplier_submissions ADD CONSTRAINT supplier_submissions_status_check CHECK(status IN ('pending','approved','rejected','inactive','deleted'));
ALTER TABLE supplier_submissions ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1 CHECK(revision>=1);
ALTER TABLE supplier_submissions ADD COLUMN IF NOT EXISTS reviewed_revision integer;
ALTER TABLE supplier_submissions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE supplier_submissions ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_listing_request_uidx ON supplier_submissions(supplier_id,request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS supplier_listing_product_idx ON supplier_submissions(product_id,updated_at DESC);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_listing_status text CHECK(supplier_listing_status IN ('pending','approved','rejected','inactive','deleted'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_listing_changed_at timestamptz;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS supplier_retired_at timestamptz;
