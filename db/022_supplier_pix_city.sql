-- Município cadastrado pelo próprio fornecedor para o BR Code. Não altera chaves ou repasses existentes.
ALTER TABLE supplier_pix_accounts ADD COLUMN IF NOT EXISTS pix_city text CHECK (char_length(pix_city) BETWEEN 2 AND 120);
