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

## Stage 4 — Reliable synchronization

- durable offline queue hardening
- retry/backoff policy
- sync acknowledgement model
- stale queue recovery
- network/battery behavior validation
- device clock handling

The current queue, heartbeat and periodic sync are already the baseline.

## Stage 5 — SaaS API completion

- mature pagination/search
- device lifecycle APIs
- notification retention/deletion semantics
- audit/event model
- plan entitlement enforcement
- API observability

## Stage 6 — Parent product UI completion

- production dashboard polish
- notification inbox UX
- device management UX
- onboarding and empty states
- responsive/mobile web layout
- accessibility and error states

## Stage 7 — Realtime experience

- SSE hardening
- reconnect/backoff
- notification/device event fan-out
- connection state UX
- multi-tab behavior

## Stage 8 — Security & privacy hardening

- authentication/session hardening
- privacy controls
- encryption/key rotation strategy
- abuse/rate-limit controls
- audit review
- data export/deletion verification
- Play disclosure review

## Stage 9 — Operations

- Docker/Nginx production deployment
- database backup/restore
- health monitoring
- log/alert strategy
- staging environment
- secret rotation
- migration workflow

## Stage 10 — Release readiness

- Android release build/AAB
- real-device testing
- Play Console declarations
- privacy/data-safety review
- live billing verification
- production smoke tests
- launch checklist

External device, Play Console, payment-provider and production-infrastructure verification are intentionally kept as the final pre-launch validation step.
