CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE sessions
SET csrf_token_hash = encode(digest(csrf_token, 'sha256'), 'hex')
WHERE csrf_token IS NOT NULL
  AND csrf_token_hash IS NULL;

ALTER TABLE sessions DROP COLUMN IF EXISTS csrf_token;
