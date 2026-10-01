# Section 1 — Free / no-device verification

## Scope
This checklist covers repository-side work that does not require paid hosting, a production account, or a physical Android device. It is not a production-readiness certificate.

## Verified GitHub Actions evidence
The following recorded runs were inspected on 2026-10-01:

- Static CI run `36703582597`: `static` and `docker` jobs completed successfully. Steps included product checks, API tests, web typecheck, web production build, Compose validation, Node syntax checks, and API/web image builds.
- Android CI run `36703582585`: `build` job completed successfully. Steps included Android unit tests, lint, debug APK assembly/upload, and CI release AAB assembly/upload.

These results apply to the commits that triggered those runs. They do not automatically verify later commits or a live deployment.

## Repository-side work represented in the current release branch
- Product, web UI, realtime, security, operations, and release check scripts exist.
- API tests are present under `services/api/test`.
- Deployment, backup/restore, release, and privacy documentation exists.
- Production deployment still requires environment-specific secrets and infrastructure.

## Remaining free checks before calling Section 1 complete
- [ ] Run the full check suite against the exact release candidate commit (not merely rely on a prior run).
- [ ] Review API test coverage against authentication, pairing, tenant isolation, notification lifecycle, billing webhooks, and password recovery.
- [ ] Review parent web flows and add automated browser-level coverage where the repository supports it.
- [ ] Review DB migrations and backup/restore scripts; execute a local restore drill where a disposable database is available.
- [ ] Review security-sensitive paths and report concrete findings with file/line references.
- [ ] Validate production Compose and deployment workflows without deploying to production.
- [ ] Review Android source and CI artifacts; real-device behaviour remains out of scope.

## Explicitly out of scope
Physical Android notification capture/background/reboot testing, Google Play Console submission, live payments/email, live TLS and production smoke checks require device access, external accounts, or infrastructure. Firebase/FCM is not assumed to be required by the current notification-capture architecture.
