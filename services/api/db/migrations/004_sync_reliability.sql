-- Stage 4: durable sync observability for child notification delivery.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS sync_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_sync_error TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS pending_count INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='devices_sync_failures_nonnegative') THEN
    ALTER TABLE devices ADD CONSTRAINT devices_sync_failures_nonnegative CHECK (sync_failures >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='devices_pending_count_nonnegative') THEN
    ALTER TABLE devices ADD CONSTRAINT devices_pending_count_nonnegative CHECK (pending_count >= 0) NOT VALID;
  END IF;
END $$;
