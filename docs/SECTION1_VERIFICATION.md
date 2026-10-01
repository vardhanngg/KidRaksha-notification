# Section 1 — Free / no-device verification

## Scope
This is a repository-side readiness pass that can be done without paid hosting, production credentials, or a physical Android device. It is not a production-readiness certificate.

## Findings and changes in this branch
- **Fixed production SMTP wiring:** `services/api/src/server.js` requires SMTP configuration at startup in production and `services/api/src/email.js` requires host/user/password/from. The production Compose API service previously did not pass those variables. This branch now passes `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`.
- **Fixed CI trigger gap:** `.github/workflows/ci.yml` previously ran pull-request CI only for PRs targeting `main`. This branch adds `stage-10-final-release` so future release-candidate PRs run static/API/web/Compose/docker checks.
- **Security and lifecycle review:** inspected auth/session cookie configuration, password hashing/rehash, encryption, SSE replay/connection limits, billing plan mapping, migrations, backup/restore scripts, and production Compose. Existing unit tests cover selected crypto/session, SSE, and plan behaviours; they do not constitute end-to-end tenant-isolation or parent journey coverage.
- **Backup/restore:** scripts use custom-format `pg_dump` and require explicit `CONFIRM_RESTORE=YES` before destructive restore. A live restore drill has not been run in this environment.

## CI evidence and limitations
Historical runs inspected on 2026-10-01:
- Static CI run `36703582597`: static and Docker jobs passed on their triggering commit.
- Android CI run `36703582585`: Android build job passed on its triggering commit.
- Android PR run `36820914850`: unit tests, lint, debug APK, and CI AAB passed for the initial PR commit.

These historical runs do not validate the latest branch head after the Compose and workflow changes. The latest PR head is `b098d20068a01e7c8c2e7693af38adef57e76689`; no workflow run was returned for that exact commit at the time this record was updated.

## Still required for full Section 1 completion
- [ ] Obtain a passing full CI run on the exact latest PR head, including the newly enabled release-branch PR trigger.
- [ ] Add/run browser-level tests for registration/login/recovery, pairing, notifications, unlink/signout, and family/tenant isolation; current API unit tests do not prove these journeys.
- [ ] Run migrations and a backup/restore drill against a disposable PostgreSQL instance.
- [ ] Complete line-by-line review of all API route authorization and Android privacy/notification lifecycle code.
- [ ] Review deployment workflows and verify generated production Compose configuration with representative values.

## Out of scope
Physical Android notification capture/background/reboot testing, Play Console submission, live payments/email, live TLS, production smoke checks, and disaster recovery on production infrastructure require devices, external accounts, or infrastructure. No claim is made that these have been completed.
