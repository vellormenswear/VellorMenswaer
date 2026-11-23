-- Cadastro de chave Pix para pagamento manual ao fornecedor.
-- Estrutura separada de suppliers: evita expor a chave em consultas administrativas gerais.
-- Migração não destrutiva: fornecedores antigos podem completar os dados no portal.
CREATE TABLE IF NOT EXISTS supplier_pix_accounts (
 supplier_id uuid PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
 pix_type text NOT NULL CHECK (pix_type IN ('cpf','cnpj','email','phone','random')),
 pix_key text NOT NULL CHECK (char_length(pix_key) BETWEEN 4 AND 255),
 holder_name text NOT NULL CHECK (char_length(holder_name) BETWEEN 3 AND 120),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE supplier_manual_payouts ADD COLUMN IF NOT EXISTS pix_key_type text;
ALTER TABLE supplier_manual_payouts ADD COLUMN IF NOT EXISTS pix_key_suffix text;
ALTER TABLE supplier_manual_payouts ADD COLUMN IF NOT EXISTS pix_holder_name text;
