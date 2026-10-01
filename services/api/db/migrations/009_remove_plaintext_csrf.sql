CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sessions'
      AND column_name = 'csrf_token'
  ) THEN
    UPDATE sessions
    SET csrf_token_hash = encode(digest(csrf_token, 'sha256'), 'hex')
    WHERE csrf_token IS NOT NULL
      AND csrf_token_hash IS NULL;
  END IF;
END $$;

ALTER TABLE sessions DROP COLUMN IF EXISTS csrf_token;
