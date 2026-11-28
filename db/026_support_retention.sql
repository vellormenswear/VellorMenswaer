-- Separate automatic chat from human support; do not alter order-linked requests.
CREATE TABLE IF NOT EXISTS support_ai_messages (
 id bigserial PRIMARY KEY,
 customer_id uuid REFERENCES users(id) ON DELETE CASCADE,
 visitor_token_hash text,
 sender_kind text NOT NULL CHECK(sender_kind IN ('visitor','bot')),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((customer_id IS NULL) <> (visitor_token_hash IS NULL))
);
CREATE INDEX IF NOT EXISTS support_ai_customer_time_idx ON support_ai_messages(customer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS support_ai_visitor_time_idx ON support_ai_messages(visitor_token_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS support_ai_expiry_idx ON support_ai_messages(created_at);
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS title text CHECK(length(title) BETWEEN 1 AND 120);
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS guest_owner_hash text;
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS rating smallint CHECK(rating BETWEEN 1 AND 5);
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS rating_comment text CHECK(length(rating_comment)<=1200);
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS rated_at timestamptz;
CREATE INDEX IF NOT EXISTS support_guest_owner_idx ON support_threads(guest_owner_hash,last_message_at DESC);
CREATE INDEX IF NOT EXISTS support_messages_expiry_idx ON support_messages(created_at);
-- Bot-only threads have unambiguous provenance. Move the still-valid portion.
INSERT INTO support_ai_messages(customer_id,visitor_token_hash,sender_kind,body,created_at)
SELECT t.customer_id,CASE WHEN t.customer_id IS NULL THEN t.visitor_token_hash ELSE NULL END,m.sender_kind,m.body,m.created_at
FROM support_threads t JOIN support_messages m ON m.thread_id=t.id
WHERE t.status='bot' AND m.sender_kind IN ('visitor','bot') AND m.created_at>now()-interval '24 hours';
DELETE FROM support_threads WHERE status='bot';
-- Identify guests explicitly. A deleted account must not become an anonymous conversation.
UPDATE support_threads SET guest_owner_hash=visitor_token_hash WHERE customer_id IS NULL AND guest_owner_hash IS NULL;
-- Split pre-handoff legacy messages only where the original handoff marker is explicit.
WITH boundary AS (
 SELECT t.id,min(m.id) AS handoff_id FROM support_threads t JOIN support_messages m ON m.thread_id=t.id
 WHERE t.status<>'bot' AND m.sender_kind='bot' AND (m.body LIKE 'Sua solicitação chegou à equipe VELLOR.%' OR m.body LIKE 'Vou encaminhar sua conversa à equipe VELLOR.%')
 GROUP BY t.id
), moved AS (
 DELETE FROM support_messages m USING boundary b WHERE m.thread_id=b.id AND m.id<b.handoff_id AND m.sender_kind IN ('visitor','bot')
 RETURNING m.thread_id,m.sender_kind,m.body,m.created_at
)
INSERT INTO support_ai_messages(customer_id,visitor_token_hash,sender_kind,body,created_at)
SELECT t.customer_id,CASE WHEN t.customer_id IS NULL THEN t.guest_owner_hash ELSE NULL END,m.sender_kind,m.body,m.created_at
FROM moved m JOIN support_threads t ON t.id=m.thread_id WHERE m.created_at>now()-interval '24 hours';
-- Keep older human messages when legacy provenance cannot be established.
UPDATE support_threads SET title='Atendimento ao cliente' WHERE title IS NULL AND status<>'bot';
UPDATE support_threads SET closed_at=updated_at WHERE status='closed' AND closed_at IS NULL;
