
#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required=(
  "apps/web/package.json"
  "apps/web/next.config.mjs"
  "apps/web/app/globals.css"
  "services/api/package.json"
  "services/api/src/server.js"
  "services/api/db/schema.sql"
  "services/api/db/migrations/002_stage2_pairing.sql"
  "apps/web/app/onboarding/page.tsx"
  "apps/android/app/src/main/AndroidManifest.xml"
  "apps/android/app/src/main/java/com/kidraksha/child/service/NotificationCaptureService.kt"
  "infra/docker-compose.yml"
)

for f in "${required[@]}"; do
  test -f "$root/$f" || { echo "MISSING $f"; exit 1; }
done

if grep -R -nE 'CAMERA|RECORD_AUDIO|ACCESS_FINE_LOCATION|BIND_ACCESSIBILITY_SERVICE|WebRTC|android.permission.VPN|DeviceAdminReceiver' \
  "$root/apps/android/app/src/main" >/tmp/kidraksha-forbidden.txt 2>/dev/null; then
  echo "Unexpected legacy capabilities found:"
  cat /tmp/kidraksha-forbidden.txt
  exit 1
fi

grep -q 'device.paired' "$root/services/api/src/server.js" || { echo "Missing device.paired event"; exit 1; }
grep -q 'updated_at' "$root/services/api/db/schema.sql" || { echo "Missing Stage 2 device metadata"; exit 1; }
grep -q 'pairing-codes/:id' "$root/services/api/src/server.js" || { echo "Missing pairing-code cancellation endpoint"; exit 1; }
grep -q 'isNotificationListenerAccessGranted' "$root/apps/android/app/src/main/java/com/kidraksha/child/ui/MainActivity.kt" || { echo "Missing modern notification-access check"; exit 1; }
grep -q 'NotificationNormalizer' "$root/apps/android/app/src/main/java/com/kidraksha/child/service/NotificationCaptureService.kt" || { echo "Missing notification normalization layer"; exit 1; }
grep -q 'notification_key_hash' "$root/services/api/db/schema.sql" || { echo "Missing notification key hashing"; exit 1; }
grep -q 'content_state' "$root/services/api/db/schema.sql" || { echo "Missing content state"; exit 1; }
if grep -R -nE 'LittleWatch|littlewatch|LITTLEWATCH' --exclude-dir=.git --exclude='check-product.sh' "$root" >/tmp/kidraksha-brand.txt 2>/dev/null; then
  echo "Legacy product branding remains:"; cat /tmp/kidraksha-brand.txt; exit 1;
fi

if grep -R -nE 'AlarmManager|setInexactRepeating|SyncReceiver|SystemReceiver' "$root/apps/android/app/src/main" 2>/dev/null; then
  echo "Legacy alarm/receiver sync implementation remains." >&2
  exit 1
fi
if ! grep -q 'androidx.work:work-runtime-ktx:2.12.0' "$root/apps/android/app/build.gradle"; then
  echo "WorkManager 2.12.0 dependency missing." >&2
  exit 1
fi
worker="$root/apps/android/app/src/main/java/com/kidraksha/child/sync/NotificationSyncWorker.kt"
scheduler="$root/apps/android/app/src/main/java/com/kidraksha/child/sync/SyncScheduler.kt"
server="$root/services/api/src/server.js"
grep -q 'setRequiredNetworkType(NetworkType.CONNECTED)' "$scheduler" || { echo "Missing connected-network constraint." >&2; exit 1; }
grep -q 'ExistingWorkPolicy.KEEP' "$scheduler" || { echo "Missing unique one-time work policy." >&2; exit 1; }
grep -q 'ExistingPeriodicWorkPolicy.KEEP' "$scheduler" || { echo "Missing unique periodic work policy." >&2; exit 1; }
grep -q 'BackoffPolicy.EXPONENTIAL' "$scheduler" || { echo "Missing exponential backoff." >&2; exit 1; }
grep -q 'queue.remove(batch.map { it.id })' "$worker" || { echo "Worker does not acknowledge queue rows after upload." >&2; exit 1; }
grep -q 'ON CONFLICT(device_id,client_notification_id) DO NOTHING' "$server" || { echo "Missing server idempotency constraint handling." >&2; exit 1; }
grep -q 'FROM devices WHERE id=\$1 FOR UPDATE' "$server" || { echo "Missing locked device-state check for notification uploads." >&2; exit 1; }
if ! grep -q 'WHERE id=\$8 AND revoked_at IS NULL' "$server"; then
  echo "Heartbeat can update revoked devices." >&2
  exit 1
fi
echo "KidRaksha product structure check: PASS"

# Stage 5 API contract checks
for f in \
  "$root/services/api/src/pagination.js" \
  "$root/services/api/src/entitlements.js" \
  "$root/services/api/src/logger.js" \
  "$root/services/api/db/migrations/006_stage5_api_completion.sql" \
  "$root/docs/API.md" \
  "$root/docs/STAGE5_API_COMPLETION.md"; do
  test -f "$f" || { echo "Missing Stage 5 file: $f"; exit 1; }
done

grep -q '/v1/meta' "$root/services/api/src/server.js" || { echo "Missing API metadata endpoint."; exit 1; }
grep -q 'nextCursor' "$root/services/api/src/server.js" || { echo "Missing cursor pagination response."; exit 1; }
grep -q 'bulk-read' "$root/services/api/src/server.js" || { echo "Missing notification bulk-read endpoint."; exit 1; }
grep -q 'bulk-delete' "$root/services/api/src/server.js" || { echo "Missing notification bulk-delete endpoint."; exit 1; }
grep -q 'app.get("/v1/audit"' "$root/services/api/src/server.js" || { echo "Missing audit endpoint."; exit 1; }
test "$(grep -c 'app.get("/v1/audit"' "$root/services/api/src/server.js")" -eq 1 || { echo "Audit endpoint is registered more than once."; exit 1; }
grep -q 'subscription_required' "$root/services/api/src/server.js" || { echo "Missing entitlement enforcement."; exit 1; }
grep -q 'X-Request-ID' "$root/services/api/src/server.js" || { echo "Missing request correlation ID."; exit 1; }
grep -q 'pino' "$root/services/api/package.json" || { echo "Missing structured logging dependency."; exit 1; }
if grep -R -nE 'lw_csrf|lw_session' "$root" --exclude-dir=.git --exclude='check-product.sh' >/tmp/kidraksha-legacy-cookie.txt 2>/dev/null; then
  echo "Legacy LittleWatch cookie names remain:"; cat /tmp/kidraksha-legacy-cookie.txt; exit 1;
fi
