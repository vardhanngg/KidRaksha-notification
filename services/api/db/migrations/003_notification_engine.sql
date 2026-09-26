-- Stage 3: notification engine metadata and privacy-aware content state.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_key_hash TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type TEXT NOT NULL DEFAULT 'other';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS group_key TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_ongoing BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_clearable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_group_summary BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS content_state TEXT NOT NULL DEFAULT 'unavailable';

UPDATE notifications
SET content_state = CASE
  WHEN title_enc IS NULL AND body_enc IS NULL THEN 'unavailable'
  ELSE 'available'
END
WHERE content_state = 'unavailable';

CREATE INDEX IF NOT EXISTS idx_notifications_parent_type ON notifications(parent_id, notification_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_parent_device ON notifications(parent_id, device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_key_hash ON notifications(device_id, notification_key_hash) WHERE notification_key_hash IS NOT NULL;
