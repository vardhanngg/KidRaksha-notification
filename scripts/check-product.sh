
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
  "apps/android/app/src/main/AndroidManifest.xml"
  "apps/android/app/src/main/java/com/littlewatch/child/service/NotificationCaptureService.kt"
  "infra/docker-compose.yml"
)

for f in "${required[@]}"; do
  test -f "$root/$f" || { echo "MISSING $f"; exit 1; }
done

if grep -R -nE 'CAMERA|RECORD_AUDIO|ACCESS_FINE_LOCATION|BIND_ACCESSIBILITY_SERVICE|WebRTC|android.permission.VPN|DeviceAdminReceiver' \
  "$root/apps/android/app/src/main" >/tmp/littlewatch-forbidden.txt 2>/dev/null; then
  echo "Unexpected legacy capabilities found:"
  cat /tmp/littlewatch-forbidden.txt
  exit 1
fi

echo "LittleWatch product structure check: PASS"
