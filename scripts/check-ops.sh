#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

pass(){ echo "OPS: PASS — $1"; }
fail(){ echo "OPS: FAIL — $1" >&2; exit 1; }

[[ -f infra/docker-compose.production.yml ]] || fail "production compose missing"
[[ -f infra/nginx-production.conf ]] || fail "production nginx config missing"
[[ -f services/api/scripts/migrate.js ]] || fail "migration runner missing"
[[ -f services/api/scripts/maintenance.js ]] || fail "maintenance worker missing"
[[ -x ops/backup-db.sh && -x ops/restore-db.sh ]] || fail "backup/restore scripts are not executable"
[[ -x ops/preflight.sh && -x ops/healthcheck.sh ]] || fail "ops scripts are not executable"
[[ -d .github/workflows ]] || fail "GitHub workflows missing"

grep -q 'service_completed_successfully' infra/docker-compose.yml || fail "local compose is not migration-gated"
grep -q 'service_completed_successfully' infra/docker-compose.production.yml || fail "production compose is not migration-gated"
grep -q 'condition: service_healthy' infra/docker-compose.yml || fail "local compose lacks health-gated dependencies"
grep -q 'condition: service_healthy' infra/docker-compose.production.yml || fail "production compose lacks health-gated dependencies"
grep -q 'USER node' services/api/Dockerfile || fail "API image must run as non-root"
grep -q 'USER node' apps/web/Dockerfile || fail "web image must run as non-root"
grep -q '/health/live' services/api/Dockerfile || fail "API container healthcheck missing"
migration_count=$(find services/api/db/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort -V | wc -l | tr -d ' ')
[[ "$migration_count" -ge 9 ]] || fail "expected Stage 2-10 migrations to be present"
python3 - <<'PY2'
from pathlib import Path
files = sorted(Path("services/api/db/migrations").glob("*.sql"), key=lambda p: int(p.name.split("_", 1)[0]))
versions = [int(p.name.split("_", 1)[0]) for p in files]
assert len(versions) == len(set(versions)), "duplicate migration version"
assert versions == sorted(versions), "migration sort failure"
print("OPS: PASS — migration numbering")
PY2

nginx_prod='infra/nginx-production.conf'
grep -q 'ssl_protocols TLSv1.2 TLSv1.3' "$nginx_prod" || fail "TLS configuration missing"
grep -q 'proxy_buffering off' "$nginx_prod" || fail "SSE buffering protection missing"
grep -q 'Strict-Transport-Security' "$nginx_prod" || fail "HSTS missing"
grep -q 'migrations' docs/STAGE9_OPERATIONS.md || fail "operations docs missing migration guidance"
grep -q 'run --rm migrate' .github/workflows/deploy-staging.yml || fail "staging workflow missing migration step"
grep -q 'run --rm migrate' .github/workflows/deploy-production.yml || fail "production workflow missing migration step"
grep -q 'concurrency:' .github/workflows/deploy-production.yml || fail "production deployment concurrency missing"
grep -q 'environment:' .github/workflows/deploy-production.yml || fail "production environment protection missing"

if grep -R -nE 'password=|postgres://[^[:space:]]+:[^[:space:]]+@|rzp_live_[A-Za-z0-9]+' --include='*.yml' --include='*.yaml' --include='*.sh' --exclude='check-ops.sh' . >/tmp/kidraksha-ops-secret-scan.txt 2>/dev/null; then
  cat /tmp/kidraksha-ops-secret-scan.txt >&2
  fail "obvious credentials found in ops config"
fi

pass "production operations structure"
