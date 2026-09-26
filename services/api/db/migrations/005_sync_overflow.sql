-- Stage 4: expose bounded local queue overflow without retaining notification content.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS sync_dropped_count BIGINT NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='devices_sync_dropped_count_nonnegative') THEN
    ALTER TABLE devices ADD CONSTRAINT devices_sync_dropped_count_nonnegative CHECK (sync_dropped_count >= 0) NOT VALID;
  END IF;
END $$;
