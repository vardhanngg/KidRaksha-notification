# Changelog

## Stage 2 — Onboarding & secure pairing
- Renamed product branding to KidSuraksha and pre-release Android package/application identity.
- Added pairing-code IDs, expiry metadata, cancellation, device-paired realtime event, device status, and rename endpoints.
- Replaced basic child pairing UI with a guided setup state machine.
- Switched notification-access detection to NotificationManager.isNotificationListenerAccessGranted on supported API levels.
- Enforced visible status-notification readiness before notification sharing can be enabled.
- Added server-backed heartbeat immediately after successful pairing.
- Added parent onboarding countdown and realtime pairing confirmation with fallback polling.
- Added Android release-build guard requiring KIDRAKSHA_API_URL.


## 2026-09-26 — SaaS foundation hardening
- Built KidSuraksha as a production-shaped notification-sharing SaaS monorepo.
- Added parent authentication, pairing, tenant-scoped notifications, SSE realtime updates, billing hooks, retention controls, export and account deletion.
- Added Android notification listener, explicit disclosure, visible sharing status, encrypted offline queue, duplicate-safe sync and fail-closed behavior.
- Added Play monitoring metadata, privacy/legal pages and external account-deletion resource.
- Hardened production configuration, HTTPS requirements, audit/webhook data retention and plan enforcement.
- Added Docker/Nginx deployment structure and release checklist.

## Stage 3 — Production Notification Engine
- Added a dedicated Android notification normalization layer.
- Added notification type/category and channel/group metadata.
- Added hashed notification keys and content-aware idempotency.
- Added explicit available/withheld/unavailable content state.
- Improved text extraction and normalization for multiline/rich notifications.
- Improved listener reconnect behavior with framework rebind requests.
- Increased sync drain capacity while retaining bounded batches.
- Added JVM tests for notification text normalization and category classification.
- Updated the SaaS inbox to surface notification type and content-sharing state.

## Stage 4 — Reliable synchronization
- Replaced AlarmManager polling with WorkManager 2.12.0 persistent sync.
- Added connected-network constraints, exponential retry/backoff and unique work.
- Added local sync health state and server-side sync observability.
- Preserved at-least-once notification delivery with server idempotency.
- Removed custom boot/sync broadcast receivers.
- Added bounded offline-queue overflow reporting and parent-device sync health visibility.
- Hardened upload handling against parent revoke/share-off races.
- Aligned Android build tooling to AGP 9.3.1 + Kotlin 2.4.20.

### Stage 5 — SaaS API completion

- keyset cursor pagination and mature notification filters
- notification lifecycle/detail/bulk endpoints
- device lifecycle/detail/status semantics
- audit pagination and realtime lifecycle events
- centralized subscription entitlements with expired-trial enforcement
- request IDs, structured logs, stable error codes and health latency
- API contract and security/resource-control documentation

## Stage 6 — Parent SaaS UI completion
- rebuilt responsive parent console shell and visual system
- completed dashboard, inbox, devices, billing, settings and onboarding UI
- added cursor-based inbox UX, filters, bulk actions and notification detail
- replaced browser dialogs with accessible in-app confirmation dialogs and toasts
- added route-level loading/error states and mobile navigation
- added web UI regression checker and accessibility-focused styling


## Stage 7 — Realtime experience
- Added a durable, tenant-scoped realtime event log with monotonic IDs.
- Hardened SSE with `Last-Event-ID` replay, session cursor fallback, replay buffering, bounded history and explicit resync signals.
- Added 20-second keep-alives, no-cache/no-buffering headers, connection caps and stream rate limiting.
- Replaced per-page EventSource connections with one shared realtime provider in the parent console.
- Added live/reconnecting/offline connection status and reconnect/resync reconciliation hooks.
- Coalesced bulk notification mutations into one realtime event each to avoid event storms.
- Added realtime framing/replay/buffering/cap tests.

## Stage 8 — Security & privacy hardening
- Hardened production sessions with `__Host-` cookies, CSRF/Origin/Fetch-Metadata validation, idle/absolute expiry and realtime session revocation.
- Upgraded password hashing to OWASP-aligned scrypt parameters with transparent legacy rehashing and added password-change/session-rotation flow.
- Added recent reauthentication for billing changes, sensitive export and account deletion.
- Added AES-256-GCM ciphertext versioning with previous-key rotation support and hardened Android backup/screenshot exposure.
- Added Redis-backed distributed rate limiting, production browser security headers and security policy documentation.
- Updated the API baseline to Express 5.2.1 and added Dependabot/release security gates.

- Hardened parent sessions with hashed CSRF tokens, `__Host-` cookies in production, SameSite=Strict, idle expiry and recent reauthentication.
- Upgraded password hashing to OWASP-aligned scrypt parameters with transparent legacy rehashing.
- Added AES-256-GCM ciphertext versioning and previous-key rotation support.
- Added Redis-backed distributed rate limiting for production.
- Added CSP/HSTS/clickjacking/referrer/permissions/resource policy headers to the SaaS UI.
- Added Origin validation for state-changing parent requests and Clear-Site-Data on logout/deletion.
- Added recent-password confirmation for billing changes and account deletion.
- Hardened Android UI screenshots and documented backup exclusion/secret handling.
- Added Stage 8 security/privacy documentation and migration 008.

## Stage 9 — Operations & deployment

- added transactional, checksum-verified database migration runner
- separated scheduled maintenance from API startup
- added API liveness/readiness probes and graceful shutdown hardening
- hardened API/web Docker images to run as non-root
- added production Nginx TLS/SSE configuration
- added PostgreSQL backup/restore and operational preflight tooling
- added protected staging/production GitHub Actions deployment workflows
- added rollback, secret-rotation and restore-drill runbooks

## Stage 10 — Release readiness
- final Android AAB/signed-release workflow and release identity controls
- public privacy/legal release materials and Play submission drafts
- password recovery with one-time expiring reset tokens and session revocation
- final release/source gate and production smoke test tooling
- final physical-device, Play Console, billing and production acceptance runbook
