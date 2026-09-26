#!/usr/bin/env sh
set -eu

base_url="${BASE_URL:?BASE_URL is required}"
body=$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 "$base_url/healthz")
printf '%s\n' "$body" | grep -q '"ok":true' || {
  echo "Health endpoint did not report ok=true" >&2
  printf '%s\n' "$body" >&2
  exit 1
}
echo 'KidRaksha external health check: PASS'
