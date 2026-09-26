#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
out="${1:-./backup-$(date +%Y%m%d-%H%M%S).dump}"
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > "$out"
echo "Backup written to $out"
