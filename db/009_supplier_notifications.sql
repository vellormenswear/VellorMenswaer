-- Leitura de notificações por fornecedor, separada da leitura administrativa.
-- As notificações existentes (incluindo o pedido de teste) são preservadas.
CREATE TABLE IF NOT EXISTS supplier_notification_reads (
 supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
 notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
 read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(supplier_id,notification_id)
);
CREATE INDEX IF NOT EXISTS supplier_notice_group_idx ON notifications ((payload->>'group_id'),created_at DESC)
 WHERE kind IN ('supplier_payment_pending','supplier_paid');
