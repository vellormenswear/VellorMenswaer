-- Informational only: never used for availability, reservation or checkout.
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS reported_stock integer CHECK (reported_stock IS NULL OR reported_stock >= 0);
