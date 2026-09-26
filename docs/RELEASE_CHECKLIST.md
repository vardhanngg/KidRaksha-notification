# LittleWatch release checklist

## Before production
- Set a real `PUBLIC_WEB_ORIGIN` and production `DATABASE_URL`.
- Generate `PAIRING_CODE_SECRET` and a 32-byte base64 `DATA_ENCRYPTION_KEY`.
- Configure Razorpay live key/secret, webhook secret, and plan IDs.
- Create Razorpay webhook events needed by the subscription lifecycle and verify the webhook URL over HTTPS.
- Replace the release Android API URL with the real HTTPS API origin.
- Review the Google Play Data Safety form, privacy policy, monitoring-tool declaration, and store listing disclosures against the production data flows.
- Verify the external `/delete-account` account-deletion URL is live and clearly identifies LittleWatch.
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
