
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
if grep -R -nE 'LittleWatch|littlewatch|LITTLEWATCH' --exclude-dir=.git --exclude='check-product.sh' "$root" >/tmp/kidraksha-brand.txt 2>/dev/null; then
  echo "Legacy product branding remains:"; cat /tmp/kidraksha-brand.txt; exit 1;
fi

echo "KidRaksha product structure check: PASS"
