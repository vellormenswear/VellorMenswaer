-- VELLOR: diagnostic event log; data minimization by design.
-- Created lazily on first server event with a transaction advisory lock.
CREATE TABLE IF NOT EXISTS checkout_trace_events (
  id bigserial PRIMARY KEY,
  trace_id uuid NOT NULL,
  stage varchar(64) NOT NULL,
  level varchar(12) NOT NULL CHECK(level IN ('info','warning','error','success')),
  code varchar(80) NOT NULL,
  message varchar(320),
  http_status integer,
  checkout_batch_id uuid,
  group_id uuid,
  preference_id varchar(100),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkout_trace_id_time_idx ON checkout_trace_events(trace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS checkout_trace_created_idx ON checkout_trace_events(created_at DESC);
CREATE INDEX IF NOT EXISTS checkout_trace_group_idx ON checkout_trace_events(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS checkout_trace_pref_idx ON checkout_trace_events(preference_id) WHERE preference_id IS NOT NULL;
