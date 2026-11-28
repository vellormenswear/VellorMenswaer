-- Internal source URLs; never included in public catalog records.
CREATE TABLE IF NOT EXISTS supplier_product_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid UNIQUE REFERENCES products(id) ON DELETE CASCADE,
 submission_id uuid UNIQUE REFERENCES supplier_submissions(id) ON DELETE CASCADE,
 source_url text NOT NULL CHECK(char_length(source_url) BETWEEN 1 AND 2048),
 last_checked_at timestamptz,
 CHECK ((product_id IS NULL) <> (submission_id IS NULL))
);
