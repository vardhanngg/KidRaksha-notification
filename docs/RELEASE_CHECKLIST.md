# KidRaksha release checklist

## Before production
- Set a real `PUBLIC_WEB_ORIGIN` and production `DATABASE_URL`.
- Generate `PAIRING_CODE_SECRET` and a 32-byte base64 `DATA_ENCRYPTION_KEY`.
- Configure Razorpay live key/secret, webhook secret, and plan IDs.
- Create Razorpay webhook events needed by the subscription lifecycle and verify the webhook URL over HTTPS.
- Replace the release Android API URL with the real HTTPS API origin.
- Review the Google Play Data Safety form, privacy policy, monitoring-tool declaration, and store listing disclosures against the production data flows.
- Verify the external `/delete-account` account-deletion URL is live and clearly identifies KidRaksha.
- Configure TLS certificates and reverse-proxy headers.
- Configure encrypted database backups and restore testing.
- Build and sign the Android release with a production keystore.
- Run full end-to-end tests on a physical Android device, including notification access, message-content opt-in, revocation, reboot, offline queueing, pairing expiry, and account deletion.

## SaaS acceptance flow
1. Parent signs up and accepts Terms/Privacy.
2. Parent creates a pairing code.
3. Child app pairs with the code.
4. Child user sees the monitoring disclosure and controls Notification Access.
5. Child user explicitly enables visible sharing.
6. Parent sees the paired device in the console.
7. Notifications arrive in the parent inbox and realtime dashboard.
8. Billing activation occurs only after verified provider webhook processing.
9. Parent can export or delete the account.
### Stage 4 synchronization checks

- Offline notification queue retains events and drains after connectivity returns.
- Duplicate upload after client crash does not create a duplicate parent notification.
- 401/403 clears local device credentials and stops further uploads.
- 409 server-side sharing disable is respected locally.
- Notification Access revocation stops sharing and is reflected in device status.
- Queue overflow is bounded and the parent sees the cumulative dropped count.
- Parent Devices page reports last sync, pending count, failures, and offline-loss telemetry.
- WorkManager work is unique, network-constrained, and its 15-minute periodic cadence is treated as inexact.
- Android 16 job quota/stop-reason behavior is validated on a real device before release.


## Stage 8 security gate
- [ ] Set `REDIS_URL` in production and verify Redis connectivity; use authenticated/TLS transport when Redis is outside the private network.
- [ ] Generate and securely store a 32-byte `DATA_ENCRYPTION_KEY`; retain the previous key only during planned rotation.
- [ ] Verify HTTPS and `__Host-` session cookies in production.
- [ ] Verify CSP, HSTS, Permissions-Policy, frame and referrer protections at the deployed host.
- [ ] Re-check the current Next.js security release immediately before deployment and apply all high/critical dependency fixes available at release time.
- [ ] Complete Play monitoring-tool, privacy and Data Safety declarations against the final build.
- [ ] Verify account deletion, password change, export reauthentication, session expiry, logout and realtime session revocation end to end.
- [ ] Run `npm --workspace @kidraksha/api test` and the production web typecheck/build in CI.

- [ ] Re-check the current Next.js security release before production deployment.
- [ ] Apply all high/critical framework and dependency security updates available at release time.
- [ ] Confirm production Redis uses authenticated/TLS transport when hosted outside the private application network.
- [ ] Confirm the production encryption key rotation procedure and previous-key retirement window.
- [ ] Verify account deletion, password change, export reauthentication, session expiry, and logout behavior end to end.
