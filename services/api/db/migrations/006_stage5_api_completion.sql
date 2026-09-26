-- Stage 5: API contract, pagination and lifecycle indexes.
-- Keyset pagination uses (received_at DESC, id DESC), so keep this ordering index hot.
CREATE INDEX IF NOT EXISTS idx_notifications_parent_received_id
  ON notifications(parent_id, received_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_parent_unread_received_id
  ON notifications(parent_id, received_at DESC, id DESC)
  WHERE deleted_at IS NULL AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_parent_device_received_id
  ON notifications(parent_id, device_id, received_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_devices_parent_created
  ON devices(parent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_parent_expiry
  ON pairing_codes(parent_id, expires_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_parent_created_id
  ON audit_log(parent_id, created_at DESC, id DESC);

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_type_check
  CHECK (actor_type IN ('parent','device','system')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period
  ON subscriptions(status, current_period_end);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_created
  ON webhook_events(provider, created_at DESC);
