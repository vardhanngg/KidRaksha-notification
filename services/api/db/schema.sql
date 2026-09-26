
CREATE TABLE IF NOT EXISTS parents (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 30 CHECK (retention_days IN (7,30,60,90)),
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT,
  csrf_token_hash TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reauthenticated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_idle ON sessions(last_seen_at);

CREATE TABLE IF NOT EXISTS pairing_codes (
  id UUID PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pairing_codes_parent_expiry ON pairing_codes(parent_id, expires_at DESC) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  device_token_hash TEXT NOT NULL UNIQUE,
  app_version TEXT,
  sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  content_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_failures INTEGER NOT NULL DEFAULT 0 CHECK (sync_failures >= 0),
  last_sync_error TEXT,
  pending_count INTEGER NOT NULL DEFAULT 0 CHECK (pending_count >= 0),
  sync_dropped_count BIGINT NOT NULL DEFAULT 0 CHECK (sync_dropped_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devices_parent ON devices(parent_id);
CREATE INDEX IF NOT EXISTS idx_devices_seen ON devices(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_devices_parent_created ON devices(parent_id, created_at DESC);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS sync_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_sync_error TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS pending_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS sync_dropped_count BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  client_notification_id TEXT NOT NULL,
  notification_key_hash TEXT,
  package_name TEXT NOT NULL,
  app_name TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'other',
  category TEXT,
  channel_id TEXT,
  group_key TEXT,
  is_ongoing BOOLEAN NOT NULL DEFAULT FALSE,
  is_clearable BOOLEAN NOT NULL DEFAULT FALSE,
  is_group_summary BOOLEAN NOT NULL DEFAULT FALSE,
  content_state TEXT NOT NULL DEFAULT 'unavailable',
  title_enc TEXT,
  body_enc TEXT,
  posted_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  UNIQUE(device_id, client_notification_id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_parent_received ON notifications(parent_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_parent_unread ON notifications(parent_id, read_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_package ON notifications(parent_id, package_name);
CREATE INDEX IF NOT EXISTS idx_notifications_parent_type ON notifications(parent_id, notification_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_parent_device ON notifications(parent_id, device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_key_hash ON notifications(device_id, notification_key_hash) WHERE notification_key_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_parent_received_id
  ON notifications(parent_id, received_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_parent_unread_received_id
  ON notifications(parent_id, received_at DESC, id DESC)
  WHERE deleted_at IS NULL AND read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_parent_device_received_id
  ON notifications(parent_id, device_id, received_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY,
  parent_id UUID NOT NULL UNIQUE REFERENCES parents(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL DEFAULT 'trial',
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_parent ON webhook_events(parent_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period ON subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_created ON webhook_events(provider, created_at DESC);

CREATE TABLE IF NOT EXISTS realtime_events (
  id BIGSERIAL PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_realtime_events_parent_id ON realtime_events(parent_id, id ASC);
CREATE INDEX IF NOT EXISTS idx_realtime_events_created ON realtime_events(created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('parent','device','system')),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_parent_time ON audit_log(parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_parent_created_id ON audit_log(parent_id, created_at DESC, id DESC);


CREATE OR REPLACE FUNCTION purge_expired_notifications() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications n
  USING parents p
  WHERE n.parent_id = p.id
    AND n.received_at < now() - make_interval(days => p.retention_days);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
