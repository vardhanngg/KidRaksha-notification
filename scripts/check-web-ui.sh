#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
web="$root/apps/web"
required=(
  "$web/app/(console)/dashboard/page.tsx"
  "$web/app/(console)/notifications/page.tsx"
  "$web/app/(console)/devices/page.tsx"
  "$web/app/(console)/billing/page.tsx"
  "$web/app/(console)/settings/page.tsx"
  "$web/app/(console)/loading.tsx"
  "$web/app/(console)/error.tsx"
  "$web/app/onboarding/page.tsx"
  "$web/components/Shell.tsx"
  "$web/components/PageHeader.tsx"
  "$web/components/ui/UI.tsx"
)
for f in "${required[@]}"; do test -f "$f" || { echo "Missing required UI file: $f"; exit 1; }; done
if grep -R -nE 'window\.(prompt|confirm)|(^|[^A-Za-z])(prompt|confirm|alert)\(' "$web" --include='*.tsx' --include='*.ts' >/tmp/kidraksha-ui-unsafe.txt 2>/dev/null; then
  echo "Raw browser dialogs remain in the web UI:"
  cat /tmp/kidraksha-ui-unsafe.txt
  exit 1
fi
if grep -R -nE 'LittleWatch|littlewatch|LITTLEWATCH' "$web" --exclude-dir=node_modules >/tmp/kidraksha-ui-brand.txt 2>/dev/null; then
  echo "Legacy product branding remains in the web UI:"
  cat /tmp/kidraksha-ui-brand.txt
  exit 1
fi
for f in "${required[@]}"; do
  case "$f" in
    *"notifications/page.tsx"*) grep -q 'nextCursor' "$f" || { echo "Notifications UI is missing cursor pagination."; exit 1; };;
    *"devices/page.tsx"*) grep -q 'ConfirmDialog' "$f" || { echo "Devices UI is missing an accessible revoke dialog."; exit 1; };;
    *"settings/page.tsx"*) grep -q 'ConfirmDialog' "$f" || { echo "Settings UI is missing an accessible deletion dialog."; exit 1; };;
  esac
done
if grep -R -n 'new EventSource' "$web/app" "$web/components" --include='*.tsx' --include='*.ts' >/tmp/kidraksha-page-sse.txt 2>/dev/null; then
  echo "Page/component-owned EventSource connections remain; realtime must be centralized:"
  cat /tmp/kidraksha-page-sse.txt
  exit 1
fi
grep -q 'RealtimeProvider' "$web/lib/realtime/client.tsx" || { echo "Missing shared realtime provider."; exit 1; }
echo "KidRaksha web UI check: PASS"
