-- Conversas vinculadas a solicitações existentes. Nenhum pedido ou pagamento é alterado.
CREATE TABLE IF NOT EXISTS customer_request_messages (
 id bigserial PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES customer_requests(id) ON DELETE CASCADE,
 sender_kind text NOT NULL CHECK(sender_kind IN ('customer','admin')),
 sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 1200),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_request_messages_request_idx ON customer_request_messages(request_id,id);
CREATE INDEX IF NOT EXISTS customer_requests_user_idx ON customer_requests(user_id,created_at DESC);
