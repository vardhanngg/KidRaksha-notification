#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
file="${1:?Usage: DATABASE_URL=... $0 /path/to/backup.dump}"

[ -f "$file" ] || { echo "Backup file not found: $file" >&2; exit 1; }
case "$file" in *.dump) ;; *) echo "Refusing non-.dump file: $file" >&2; exit 1;; esac

if [ "${CONFIRM_RESTORE:-}" != "YES" ]; then
  echo "Destructive restore. Set CONFIRM_RESTORE=YES to continue." >&2
  exit 2
fi

pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname="$DATABASE_URL" "$file"
printf 'Restore completed from %s\n' "$file"
