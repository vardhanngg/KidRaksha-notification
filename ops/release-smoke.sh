#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:?Set BASE_URL to the production website URL}"
BASE_URL="${BASE_URL%/}"
case "$BASE_URL" in https://*) ;; *) echo "BASE_URL must use HTTPS" >&2; exit 1;; esac

check(){
  local path="$1" expected="$2" tmp status
  tmp=$(mktemp)
  status=$(curl -fsS -o "$tmp" -w '%{http_code}' --max-time 15 "$BASE_URL$path") || { rm -f "$tmp"; echo "SMOKE: FAIL $path request" >&2; exit 1; }
  if [[ "$status" != "$expected" ]]; then rm -f "$tmp"; echo "SMOKE: FAIL $path HTTP $status" >&2; exit 1; fi
  rm -f "$tmp"
  echo "SMOKE: PASS $path"
}

check /healthz 200
check / 200
check /privacy 200
check /terms 200
check /delete-account 200
check /login 200
check /forgot-password 200
check /reset-password 200

auth_status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$BASE_URL/api/auth/session" || true)
[[ "$auth_status" == "401" ]] || { echo "SMOKE: FAIL unauthenticated session route returned HTTP $auth_status" >&2; exit 1; }
echo "SMOKE: PASS unauthenticated session route"

headers=$(curl -fsSI --max-time 15 "$BASE_URL/")
printf '%s\n' "$headers" | grep -qi '^strict-transport-security:' || { echo "SMOKE: FAIL missing HSTS" >&2; exit 1; }
printf '%s\n' "$headers" | grep -qi '^x-content-type-options: nosniff' || { echo "SMOKE: FAIL missing nosniff" >&2; exit 1; }
echo "SMOKE: PASS security headers"
