# KidSuraksha release checklist

## Repository gates
- [ ] `bash scripts/check-product.sh`
- [ ] `bash scripts/check-web-ui.sh`
- [ ] `bash scripts/check-realtime.sh`
- [ ] `bash scripts/check-security.sh`
- [ ] `bash scripts/check-ops.sh`
- [ ] `bash scripts/check-release.sh`
- [ ] API tests pass in CI
- [ ] Web typecheck/build pass in CI
- [ ] Android test/lint/bundleRelease pass in CI

## Backend/SaaS
- [ ] Production secrets generated outside Git
- [ ] SMTP delivery verified
- [ ] Redis auth/private networking verified
- [ ] Razorpay live keys, plan IDs and webhook secret verified
- [ ] webhook signature and idempotency verified
- [ ] database migrations applied successfully
- [ ] backup and restore drill completed
- [ ] external `/healthz` monitor active

## Android release
- [ ] versionCode increased from previous Play upload
- [ ] production HTTPS API URL configured
- [ ] release keystore available only through CI secrets
- [ ] signed AAB built with `KIDRAKSHA_REQUIRE_SIGNING=true`
- [ ] AAB SHA-256 recorded
- [ ] mapping file archived when present
- [ ] physical Android test matrix completed

## Play Console
- [ ] app category/target audience reviewed
- [ ] monitoring-tool declaration reviewed
- [ ] privacy policy public URL verified
- [ ] Data Safety answers reconciled to final build/backend
- [ ] account deletion path and external URL verified
- [ ] store listing disclosures reviewed
- [ ] reviewer access instructions prepared
- [ ] content rating completed

## Launch
- [ ] production smoke tests pass
- [ ] billing checkout/webhook test pass
- [ ] password reset delivered end-to-end
- [ ] notification capture and realtime delivery verified
- [ ] rollback tag documented
- [ ] on-call/support contact published
