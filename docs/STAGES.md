# Product stages

> **Build policy:** every stage is implemented inside the same final SaaS architecture and UI. We do not create disposable prototypes between stages.

## Stage 1 — Product foundation ✅
Complete.

- notification-focused monorepo
- parent SaaS console
- Android child foundation
- authenticated API and tenant-scoped database
- secure token/content storage foundations
- deployment and privacy structure

## Stage 2 — Onboarding & secure pairing ✅
Complete.

- parent setup wizard
- expiring one-time pairing codes
- pairing-code cancellation
- realtime device-paired event with polling fallback
- Android guided setup state machine
- modern Notification Listener access check
- Android notification-permission gate for the visible monitoring status
- explicit sharing consent and separate message-content consent
- fail-closed sharing when required access/visibility is lost
- device rename/revoke
- pairing heartbeat and device status endpoint

## Stage 3 — Notification capture ✅
Complete.

- production notification normalization
- package/app metadata handling
- multiline/conversation fallbacks
- notification type/category classification
- notification key hashing
- explicit available/withheld/unavailable content state
- Android 15+ redaction-safe behavior
- encrypted queue metadata and bounded sync draining
- listener reconnect/rebind behavior
- JVM capture-helper tests

The normalized notification contract is now the foundation for reliable synchronization and the parent inbox.

## Stage 4 — Reliable synchronization ✅
Complete.

- durable encrypted offline queue hardening
- retry/backoff policy
- at-least-once acknowledgement model with server idempotency
- stale queue recovery after process/network failures
- connected-network WorkManager scheduling
- bounded queue overflow reporting
- parent-visible sync health
- server-side race protection for device sharing/revocation state

The current WorkManager, heartbeat and notification upload paths form the reliability baseline.

## Stage 5 — SaaS API completion ✅
Complete.

- opaque keyset notification pagination with bounded legacy offset mode
- explicit notification search/filter scope
- notification detail/read/unread/bulk/delete lifecycle APIs
- REST-style device detail/rename/revoke lifecycle endpoints
- tenant-scoped audit pagination and event fan-out
- centralized subscription entitlement policy and expired-trial enforcement
- per-parent billing creation locking and safer webhook plan handling
- structured request logging, request IDs, error codes and database health latency
- current dependency baseline for validation/rate limiting/logging

The API contract is documented in `docs/API.md` and `docs/STAGE5_API_COMPLETION.md`.

## Stage 6 — Parent product UI completion ✅
Complete.

- production dashboard and family workspace shell
- notification inbox with cursor pagination, filters, bulk actions and detail view
- device management health/status UX, rename and revoke dialogs
- billing/pricing product UI and checkout states
- settings, privacy controls, export and deletion UX
- onboarding flow with pairing-code feedback and completion state
- responsive/mobile web layout and navigation
- keyboard focus, skip link, reduced-motion support and accessible dialogs
- route-level loading and error states

The web UI now consumes the Stage 5 API as a customer-facing SaaS rather than a prototype inspector.


## Stage 7 — Realtime experience ✅
Complete.

- durable SSE event IDs and replay
- reconnect/backoff and resync
- notification/device event fan-out
- shared console connection state UX
- multi-tab-safe realtime client behavior

## Stage 8 — Security & privacy hardening ✅
Complete.

- authentication/session and CSRF hardening
- password strengthening, password change, reauthentication
- notification encryption and encryption-key rotation support
- Redis-backed distributed abuse/rate-limit controls
- browser security headers and session revocation
- Android secret/backup/screenshot protections
- export/deletion security controls and release security gate
- Play monitoring/privacy disclosure review

## Stage 9 — Operations & deployment ✅
Complete.

- health-gated Docker Compose topology
- dedicated migration runner with advisory lock and checksums
- dedicated maintenance worker
- liveness/readiness health endpoints
- production Nginx/TLS configuration for HTTPS and SSE
- non-root API/web containers
- PostgreSQL backup/restore tooling and restore-drill guidance
- production/staging deployment workflows with protected GitHub environments and concurrency
- deployment-host preflight and external health-check scripts
- rollback and secret-rotation runbooks

## Stage 10 — Release readiness

- Android release build/AAB
- real-device testing
- Play Console declarations
- privacy/data-safety review
- live billing verification
- production smoke tests
- launch checklist

External device, Play Console, payment-provider and production-infrastructure verification are intentionally kept as the final pre-launch validation step.
