-- Atendimento híbrido VELLOR: respostas automáticas e encaminhamento voluntário para ADM.
-- Migração aditiva, sem apagar mensagens, usuários ou pedidos.
CREATE TABLE IF NOT EXISTS support_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 visitor_token_hash text NOT NULL UNIQUE,
 customer_id uuid REFERENCES users(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'bot' CHECK (status IN ('bot','waiting','active','closed')),
 assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
 requested_at timestamptz,
 last_message_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_threads_admin_idx ON support_threads(status,last_message_at DESC);
CREATE INDEX IF NOT EXISTS support_threads_customer_idx ON support_threads(customer_id,created_at DESC);
CREATE TABLE IF NOT EXISTS support_messages (
 id bigserial PRIMARY KEY,
 thread_id uuid NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
 sender_kind text NOT NULL CHECK (sender_kind IN ('visitor','bot','admin')),
 sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_thread_idx ON support_messages(thread_id,id);
