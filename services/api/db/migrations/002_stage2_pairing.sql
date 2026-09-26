-- Stage 2: onboarding/pairing metadata
ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE devices SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL;
