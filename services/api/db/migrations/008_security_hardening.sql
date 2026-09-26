-- Stage 8: session, CSRF, security, and privacy hardening.
ALTER TABLE sessions ALTER COLUMN csrf_token DROP NOT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS csrf_token_hash TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_reauthenticated_at TIMESTAMPTZ;
UPDATE sessions SET last_seen_at=COALESCE(last_seen_at,created_at,now()) WHERE last_seen_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_idle ON sessions(last_seen_at);

-- New sessions use csrf_token_hash. Existing sessions with csrf_token are upgraded lazily on first state-changing request.
