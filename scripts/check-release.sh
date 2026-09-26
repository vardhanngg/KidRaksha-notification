#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
pass(){ echo "RELEASE: PASS — $1"; }
fail(){ echo "RELEASE: FAIL — $1" >&2; exit 1; }

[[ -f apps/android/app/build.gradle ]] || fail "Android build file missing"
[[ -f .github/workflows/release-android.yml ]] || fail "signed Android release workflow missing"
[[ -f .github/workflows/codeql.yml ]] || fail "CodeQL workflow missing"
[[ -f .github/dependabot.yml ]] || fail "Dependabot configuration missing"
[[ -f docs/STAGE10_FINAL.md ]] || fail "final release runbook missing"
[[ -f docs/PLAY_DATA_SAFETY.md ]] || fail "Play Data Safety draft missing"
[[ -f docs/PLAY_REVIEW_ACCESS.md ]] || fail "Play review access guide missing"
[[ -f docs/PLAY_STORE_LISTING.md ]] || fail "Play store listing draft missing"
[[ -f ops/release-smoke.sh && -x ops/release-smoke.sh ]] || fail "release smoke script missing/executable bit absent"

awk '/compileSdk 36/{f=1} END{exit !f}' apps/android/app/build.gradle || fail "compileSdk must be 36"
awk '/targetSdk 36/{f=1} END{exit !f}' apps/android/app/build.gradle || fail "targetSdk must be 36"
grep -q 'versionCode Integer.parseInt' apps/android/app/build.gradle || fail "version code must be configurable"
grep -q 'versionName configuredVersionName' apps/android/app/build.gradle || fail "version name must be configurable"
grep -q 'KIDRAKSHA_REQUIRE_SIGNING' apps/android/app/build.gradle || fail "release signing gate missing"
grep -q 'must use HTTPS for release builds' apps/android/app/build.gradle || fail "release API must be HTTPS"
grep -q 'bundleRelease' .github/workflows/release-android.yml || fail "release workflow must build AAB"
grep -q 'jarsigner -verify' .github/workflows/release-android.yml || fail "release workflow must verify AAB signature"
grep -q 'PUBLIC_WEB_ORIGIN=\${{ vars.PUBLIC_URL }}' .github/workflows/deploy-production.yml || fail "production web image must receive public origin at build time"
grep -q 'ANDROID_KEYSTORE_B64' .github/workflows/release-android.yml || fail "release workflow keystore secret missing"
grep -q 'ANDROID_VERSION_NAME' .github/workflows/release-android.yml || fail "release workflow version-name variable missing"
grep -q 'KIDRAKSHA_REQUIRE_SIGNING: "true"' .github/workflows/release-android.yml || fail "release workflow must fail closed without signing"
grep -q 'isMonitoringTool' apps/android/app/src/main/AndroidManifest.xml || fail "monitoring-tool declaration missing"
grep -q 'android:value="child_monitoring"' apps/android/app/src/main/AndroidManifest.xml || fail "child monitoring declaration missing"

permissions=$(grep -o 'android.permission.[A-Z_]*' apps/android/app/src/main/AndroidManifest.xml | sort -u || true)
for p in CAMERA RECORD_AUDIO ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION READ_SMS RECEIVE_SMS READ_CALL_LOG READ_CONTACTS READ_PHONE_STATE REQUEST_INSTALL_PACKAGES PACKAGE_USAGE_STATS; do
  echo "$permissions" | grep -q "$p" && fail "forbidden permission present: $p" || true
done

grep -q 'Theme.KidRaksha.Starting' apps/android/app/src/main/AndroidManifest.xml || fail "Android splash theme missing"
grep -q 'Theme.SplashScreen' apps/android/app/src/main/res/values/themes.xml || fail "SplashScreen theme missing"

[[ -f apps/web/app/privacy/page.tsx ]] || fail "public privacy page missing"
[[ -f apps/web/app/delete-account/page.tsx ]] || fail "public deletion page missing"
[[ -f apps/web/app/reset-password/page.tsx ]] || fail "password reset page missing"
[[ -f apps/web/app/reset-password/ResetPasswordForm.tsx ]] || fail "password reset form missing"
[[ -f apps/web/app/forgot-password/page.tsx ]] || fail "password recovery request page missing"
grep -q 'password-reset/request' services/api/src/server.js || fail "password reset request endpoint missing"
grep -q 'password-reset/confirm' services/api/src/server.js || fail "password reset confirm endpoint missing"

secret_scan_paths=(services/api/src services/api/scripts apps/web .github/workflows infra ops)
if grep -R -nE 'BEGIN (RSA|OPENSSH) PRIVATE KEY|rzp_live_[A-Za-z0-9]{8,}|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@' \
    --exclude-dir=node_modules --exclude-dir=.next --exclude='check-*.sh' "${secret_scan_paths[@]}" >/tmp/kidraksha-release-secrets.txt 2>/dev/null; then
  cat /tmp/kidraksha-release-secrets.txt >&2
  fail "possible secret/credential found in release source or ops files"
fi

if grep -R -nE 'littlewatch|LittleWatch' --exclude-dir=.git --exclude='check-*.sh' . >/tmp/kidraksha-release-brand.txt 2>/dev/null; then
  cat /tmp/kidraksha-release-brand.txt >&2
  fail "legacy branding remains"
fi

pass "release readiness source gate"
