-- Identificação comercial imutável, independente de UUID, SKU e slug.
-- Contadores transacionais por prefixo; códigos de itens excluídos não são reutilizados.
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code text;
CREATE TABLE IF NOT EXISTS product_code_counters (
 prefix text PRIMARY KEY CHECK(prefix ~ '^[A-Z0-9]{3}$'),
 last_number bigint NOT NULL CHECK(last_number>0)
);
CREATE OR REPLACE FUNCTION vellor_product_prefix(category_slug text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE COALESCE(category_slug,'')
  WHEN 'camisetas' THEN 'CAM' WHEN 'camisas' THEN 'CMS' WHEN 'calcas' THEN 'CAL'
  WHEN 'polos' THEN 'POL' WHEN 'bermudas-e-shorts' THEN 'BER'
  WHEN 'ternos-e-alfaiataria' THEN 'TER' WHEN 'casacos-e-jaquetas' THEN 'CAS'
  WHEN 'vestuario-esportivo' THEN 'ESP' WHEN 'roupas-intimas' THEN 'INT'
  WHEN 'tenis-casuais' THEN 'TEN' WHEN 'tenis-esportivos' THEN 'TEN' WHEN 'tenis' THEN 'TEN'
  WHEN 'sapatos-sociais' THEN 'SAP' WHEN 'mocassins' THEN 'MOC' WHEN 'botas' THEN 'BOT'
  WHEN 'chinelos-e-sandalias' THEN 'CHI' WHEN 'luvas' THEN 'LUV'
  WHEN 'relogios' THEN 'REL' WHEN 'relogios-classicos' THEN 'REL'
  WHEN 'relogios-esportivos' THEN 'REL' WHEN 'relogios-digitais' THEN 'REL'
  WHEN 'smartwatches' THEN 'SMT' WHEN 'pulseiras-para-relogios' THEN 'PLR'
  WHEN 'estojos-e-organizadores' THEN 'EST' WHEN 'oculos-de-sol' THEN 'OCU'
  WHEN 'pulseiras' THEN 'PUL' WHEN 'correntes-e-colares' THEN 'COL'
  WHEN 'aneis' THEN 'ANE' WHEN 'carteiras' THEN 'CAR' WHEN 'cintos' THEN 'CIN'
  WHEN 'bones-e-chapeus' THEN 'BON' WHEN 'gravatas' THEN 'GRA' WHEN 'bolsas-e-mochilas' THEN 'BOL'
  WHEN 'vestuario' THEN 'VES' WHEN 'calcados' THEN 'CLC' WHEN 'acessorios' THEN 'ACE'
  WHEN '' THEN 'PRD'
  ELSE COALESCE(NULLIF(rpad(left(upper(regexp_replace(category_slug,'[^a-zA-Z0-9]','','g')),3),3,'X'),'XXX'),'PRD') END;
$$;
CREATE OR REPLACE FUNCTION vellor_next_product_code(category uuid, archived boolean DEFAULT false) RETURNS text LANGUAGE plpgsql AS $$
DECLARE code_prefix text; seq bigint;
BEGIN
 SELECT vellor_product_prefix(slug) INTO code_prefix FROM categories WHERE id=category;
 code_prefix:=CASE WHEN archived THEN 'ARC' ELSE COALESCE(code_prefix,'PRD') END;
 INSERT INTO product_code_counters(prefix,last_number) VALUES(code_prefix,1)
 ON CONFLICT(prefix) DO UPDATE SET last_number=product_code_counters.last_number+1
 RETURNING last_number INTO seq;
 RETURN code_prefix||'-'||lpad(seq::text,GREATEST(6,length(seq::text)),'0');
END;$$;
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT id,category_id,launch_archived_at FROM products WHERE product_code IS NULL ORDER BY created_at NULLS LAST,id LOOP
  UPDATE products SET product_code=vellor_next_product_code(p.category_id,p.launch_archived_at IS NOT NULL) WHERE id=p.id;
 END LOOP;
END $$;
ALTER TABLE products ALTER COLUMN product_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_product_code_uidx ON products(product_code);
CREATE OR REPLACE FUNCTION vellor_product_code_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.product_code:=vellor_next_product_code(NEW.category_id,NEW.launch_archived_at IS NOT NULL);
 ELSIF NEW.product_code IS DISTINCT FROM OLD.product_code THEN
  RAISE EXCEPTION 'Código de produto é permanente' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER vellor_product_code_guard_trigger BEFORE INSERT OR UPDATE OF product_code ON products
 FOR EACH ROW EXECUTE FUNCTION vellor_product_code_guard();
