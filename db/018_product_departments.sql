ALTER TABLE products ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT 'masculino' CHECK (department IN ('masculino','feminino'));
ALTER TABLE supplier_submissions ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT 'masculino' CHECK (department IN ('masculino','feminino'));
CREATE INDEX IF NOT EXISTS products_department_idx ON products(department);
