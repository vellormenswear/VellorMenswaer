-- Novas transações usam exclusivamente InfinitePay. Não modifica registros históricos.
ALTER TABLE payments ALTER COLUMN provider SET DEFAULT 'infinitepay';
