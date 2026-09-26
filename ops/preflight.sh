#!/usr/bin/env sh
set -eu

: "${DOMAIN:?DOMAIN is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${DATA_ENCRYPTION_KEY:?DATA_ENCRYPTION_KEY is required}"
: "${PAIRING_CODE_SECRET:?PAIRING_CODE_SECRET is required}"
: "${RAZORPAY_WEBHOOK_SECRET:?RAZORPAY_WEBHOOK_SECRET is required}"
: "${REDIS_PASSWORD:?REDIS_PASSWORD is required}"
: "${TLS_DIR:?TLS_DIR is required}"

[ "${#POSTGRES_PASSWORD}" -ge 24 ] || { echo 'POSTGRES_PASSWORD must be at least 24 characters' >&2; exit 1; }
case "$POSTGRES_PASSWORD" in *[!A-Za-z0-9._~-]*) echo 'POSTGRES_PASSWORD must use URL-safe characters (A-Z/a-z/0-9/._~-) for the Compose DATABASE_URL' >&2; exit 1;; esac
[ "${#PAIRING_CODE_SECRET}" -ge 32 ] || { echo 'PAIRING_CODE_SECRET must be at least 32 characters' >&2; exit 1; }
[ "${#RAZORPAY_WEBHOOK_SECRET}" -ge 16 ] || { echo 'RAZORPAY_WEBHOOK_SECRET must be at least 16 characters' >&2; exit 1; }
[ "${#REDIS_PASSWORD}" -ge 24 ] || { echo 'REDIS_PASSWORD must be at least 24 characters' >&2; exit 1; }
case "$REDIS_PASSWORD" in *[!A-Za-z0-9._~-]*) echo 'REDIS_PASSWORD must use URL-safe characters (A-Z/a-z/0-9/._~-) for the Compose REDIS_URL' >&2; exit 1;; esac

decoded_bytes=$(printf '%s' "$DATA_ENCRYPTION_KEY" | base64 -d 2>/dev/null | wc -c | tr -d ' ') || { echo 'DATA_ENCRYPTION_KEY must be valid base64' >&2; exit 1; }; [ "$decoded_bytes" -eq 32 ] || { echo 'DATA_ENCRYPTION_KEY must decode to exactly 32 bytes' >&2; exit 1; }

[ -r "$TLS_DIR/fullchain.pem" ] || { echo "Missing TLS certificate: $TLS_DIR/fullchain.pem" >&2; exit 1; }
[ -r "$TLS_DIR/privkey.pem" ] || { echo "Missing TLS key: $TLS_DIR/privkey.pem" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || { echo 'docker is required' >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo 'docker compose plugin is required' >&2; exit 1; }

echo 'KidSuraksha production preflight: PASS'
