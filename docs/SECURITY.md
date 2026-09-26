
# Security baseline

## Secrets

Do not commit:
- database credentials
- session secrets
- encryption keys
- device tokens
- Razorpay secrets
- SMTP credentials

Use environment variables or a managed secret store in production.

## Passwords

Passwords use Node's built-in `crypto.scrypt` with per-user random salt. The application never stores plaintext passwords.

## Notification data

Title/body are encrypted with AES-256-GCM. The encryption key never leaves the API process.

## Device tokens

Only SHA-256 hashes are persisted. Pairing returns the plaintext token once.

## CSRF

Browser mutation endpoints require a double-submit token:
- non-HttpOnly `lw_csrf` cookie
- `X-CSRF-Token` request header

## Rate limits

Separate throttles are applied to:
- signup/login
- pairing
- device endpoints
- notification upload

## Audit events

The API records:
- login
- logout
- pairing-code creation
- device pair
- device revoke
- notification deletion
- billing state changes
- retention changes

## Threats considered

- stolen browser session
- brute-force login
- pairing-code guessing
- device-token replay
- duplicate notification delivery
- tenant data leakage
- forged billing webhooks
- stale device status
- accidental plaintext logs

## Operational controls

Enable:
- TLS
- database backups
- structured logs
- alerting on repeated authentication failures
- secret rotation
- database encryption at rest
- restricted production access
