-- Explicit third-party delivery; NULL retains legacy records without inferring intent.
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS deliver_to_third_party boolean;
