#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

bash scripts/check-product.sh
bash scripts/check-web-ui.sh
bash scripts/check-realtime.sh
bash scripts/check-security.sh
bash scripts/check-ops.sh
bash scripts/check-release.sh

for f in services/api/src/*.js services/api/scripts/*.js; do
  node --check "$f"
done

for f in scripts/*.sh ops/*.sh; do
  bash -n "$f"
done

printf 'KidSuraksha final source gate: PASS\n'
