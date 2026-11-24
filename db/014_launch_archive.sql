-- Marcadores de arquivamento. Não apaga registros financeiros nem dados automaticamente.
ALTER TABLE users ADD COLUMN IF NOT EXISTS launch_archived_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS launch_archived_at timestamptz;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS launch_archived_at timestamptz;
