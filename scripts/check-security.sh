#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

fail(){ echo "SECURITY CHECK FAILED: $1" >&2; exit 1; }
pass(){ echo "SECURITY: PASS — $1"; }

grep -q 'csrf_token_hash' "$root/services/api/db/schema.sql" || fail "schema missing CSRF hash"
grep -q 'last_reauthenticated_at' "$root/services/api/db/schema.sql" || fail "schema missing reauth timestamp"
grep -q '__Host-kidraksha_session' "$root/services/api/src/auth.js" || fail "production host cookie missing"
grep -q 'SameSite.*strict\|sameSite: "strict"' "$root/services/api/src/auth.js" || fail "SameSite=Strict missing"
grep -q 'sec-fetch-site' "$root/services/api/src/server.js" || fail "Fetch Metadata defense missing"
grep -q 'passwordNeedsRehash' "$root/services/api/src/server.js" || fail "password rehash path missing"
grep -q '/v1/auth/password' "$root/services/api/src/server.js" || fail "password change endpoint missing"
grep -q 'refreshSessionActivity' "$root/services/api/src/server.js" || fail "SSE session revocation check missing"
grep -q 'session.revoked' "$root/apps/web/lib/realtime/client.tsx" || fail "web session revocation handler missing"
grep -q 'reauthentication_required' "$root/services/api/src/server.js" || fail "sensitive export reauth missing"
grep -q 'REDIS_URL' "$root/.env.production.example" || fail "production Redis configuration missing"
grep -q 'rate-limit-redis' "$root/services/api/package.json" || fail "distributed rate limiter dependency missing"
grep -q 'DATA_ENCRYPTION_KEY_PREVIOUS' "$root/services/api/src/crypto.js" || fail "key rotation support missing"
grep -q 'Content-Security-Policy' "$root/apps/web/next.config.mjs" || fail "web CSP missing"
grep -q 'FLAG_SECURE' "$root/apps/android/app/src/main/java/com/kidraksha/child/ui/MainActivity.kt" || fail "Android screenshot protection missing"
if grep -R -nE 'x-session-token' "$root/services/api/src" >/tmp/kidraksha-session-header.txt 2>/dev/null; then fail "legacy session header still accepted"; fi
if grep -R -nE 'console\.(log|info|warn|error).*\b(body|title|text)\b' "$root/apps/android/app/src/main/java" >/tmp/kidraksha-sensitive-log.txt 2>/dev/null; then fail "possible sensitive notification logging"; fi
pass "session + CSRF hardening present"
pass "distributed rate limiting configuration present"
pass "browser security headers present"
pass "Android privacy hardening present"
