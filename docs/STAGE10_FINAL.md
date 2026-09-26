# Stage 10 — Final release readiness

## Engineering status
Repository release engineering is complete. The final launch gate is real-environment verification.

### Static/repository gates
- [ ] `bash scripts/check-release.sh`
- [ ] `bash scripts/check-product.sh`
- [ ] `bash scripts/check-web-ui.sh`
- [ ] `bash scripts/check-realtime.sh`
- [ ] `bash scripts/check-security.sh`
- [ ] `bash scripts/check-ops.sh`
- [ ] API tests pass in CI
- [ ] Web typecheck/build pass in CI
- [ ] Android test/lint/bundleRelease pass in CI

### Production configuration
- [ ] Production `PUBLIC_WEB_ORIGIN` is HTTPS
- [ ] SMTP is configured and password reset email delivered
- [ ] Redis is authenticated and private/TLS where applicable
- [ ] `DATA_ENCRYPTION_KEY` is generated/stored outside Git
- [ ] `PAIRING_CODE_SECRET` is generated/stored outside Git
- [ ] Razorpay live keys/plan IDs/webhook secret configured
- [ ] TLS certificate and key installed outside Git
- [ ] Database backup schedule active
- [ ] Restore drill completed

### Physical Android acceptance matrix
- [ ] Fresh install
- [ ] Android 13+ notification permission flow
- [ ] Android Notification Access enable/disable
- [ ] Monitoring disclosure visible before enablement
- [ ] Message-content opt-in/out
- [ ] Persistent KidRaksha status notification
- [ ] Notification capture from multiple app types
- [ ] Redacted/missing content behaves safely
- [ ] Offline queue + reconnect
- [ ] Duplicate/retry behavior
- [ ] Device unpair/revoke
- [ ] App reboot/process restart
- [ ] Android 15 device
- [ ] Android 16 device
- [ ] Small phone and large-screen/resizable environment
- [ ] Screenshots of privacy/disclosure/status UI

### Parent SaaS acceptance
- [ ] Signup + policy acceptance
- [ ] Login/logout
- [ ] Password reset request and confirmation
- [ ] Reset link expires and cannot be reused
- [ ] Password reset revokes previous sessions
- [ ] Pairing code lifecycle
- [ ] Realtime notification delivery
- [ ] Pagination/filter/search
- [ ] Read/delete/bulk actions
- [ ] Device rename/revoke
- [ ] Billing checkout + webhook activation
- [ ] Trial expiry enforcement
- [ ] Export with reauthentication
- [ ] Account deletion with password confirmation
- [ ] Realtime session closes after session revocation

### Production smoke
Set `BASE_URL` and run:

```bash
BASE_URL=https://app.example.com bash ops/release-smoke.sh
```

### Release artifact
The Android release workflow requires a release keystore and produces a signed `.aab` plus SHA-256 checksum. Never commit the keystore.

### Current policy facts to re-check at submission
As of September 26, 2026, new Google Play apps and updates must target Android 16/API 36 or higher. KidRaksha targets API 36. Google Play's parental-monitoring policy requires the `isMonitoringTool` manifest declaration with `child_monitoring` for qualifying monitoring apps, and account-creating apps must provide in-app and web deletion paths. Re-check the live policy pages immediately before submission because Play policies can change.

### Release decision
Stage 10 is considered **release ready** only when the real-environment checklist above is completed and evidence is recorded by the service operator. Static checks alone are not a substitute for device, Play Console, payment-provider and production tests.
