#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
out="${1:-./backup-$(date -u +%Y%m%dT%H%M%SZ).dump}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"

dir=$(dirname "$out")
mkdir -p "$dir"
tmp="${out}.tmp.$$"
trap 'rm -f "$tmp"' EXIT INT TERM

umask 077
pg_dump --format=custom --no-owner --no-privileges --file="$tmp" "$DATABASE_URL"
mv -f "$tmp" "$out"
chmod 600 "$out"

# Retain backups created by this script's default naming convention.
case "$out" in
  ./backup-*|backup-*)
    find "$dir" -type f -name 'backup-*.dump' -mtime "+$retention_days" -delete
    ;;
esac

printf 'Backup written to %s\n' "$out"
