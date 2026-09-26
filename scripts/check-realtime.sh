#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
server="$root/services/api/src/server.js"
events="$root/services/api/src/events.js"
provider="$root/apps/web/lib/realtime/client.tsx"
nginx="$root/infra/nginx.conf"

required=(
  "$events"
  "$provider"
  "$root/services/api/db/migrations/007_realtime_events.sql"
  "$root/services/api/test/events.test.js"
  "$root/docs/STAGE7_REALTIME.md"
)
for f in "${required[@]}"; do test -f "$f" || { echo "Missing Stage 7 realtime file: $f"; exit 1; }; done

grep -q 'app.get("/v1/events/stream"' "$server" || { echo "Missing SSE endpoint."; exit 1; }
grep -q 'replayEvents' "$server" || { echo "Missing event replay integration."; exit 1; }
grep -q 'Last-Event-ID' "$root/docs/API.md" || { echo "API realtime contract missing Last-Event-ID semantics."; exit 1; }
grep -q 'proxy_buffering off' "$nginx" || { echo "Nginx SSE buffering is not disabled."; exit 1; }
grep -q 'proxy_read_timeout 1h' "$nginx" || { echo "Nginx SSE read timeout is too short."; exit 1; }
grep -q 'EventSource' "$provider" || { echo "Web realtime provider is missing EventSource."; exit 1; }
grep -q 'resync.required' "$provider" || { echo "Web provider is missing resync handling."; exit 1; }
if grep -R -n 'new EventSource' "$root/apps/web/app" "$root/apps/web/components" --include='*.ts' --include='*.tsx' >/tmp/kidraksha-page-sse.txt 2>/dev/null; then
  echo "Page/component-owned EventSource connections remain; realtime must be centralized:"; cat /tmp/kidraksha-page-sse.txt; exit 1;
fi
grep -q 'realtime_events' "$root/services/api/db/schema.sql" || { echo "Schema missing realtime event table."; exit 1; }
grep -q 'device.sync.updated' "$server" || { echo "Missing device sync realtime event."; exit 1; }
grep -q 'notifications.bulk-read' "$server" || { echo "Missing coalesced bulk-read realtime event."; exit 1; }
grep -q 'notifications.bulk-deleted' "$server" || { echo "Missing coalesced bulk-delete realtime event."; exit 1; }
echo "KidSuraksha realtime check: PASS"
