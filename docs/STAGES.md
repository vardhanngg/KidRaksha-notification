
# Product stages

> **Build policy:** every stage is implemented as part of the final SaaS architecture and UI. There is no temporary developer-only dashboard or disposable bootstrap path. External device, Play Console, payment-provider and production-infrastructure verification still happens before launch.

The codebase is organized so the original 10-stage plan becomes one coherent SaaS product.

## Stage 1 — Product foundation
Implemented:
- isolated notification-focused monorepo
- SaaS data model
- authenticated web console
- Android child app foundation

## Stage 2 — Child onboarding
Implemented:
- pairing-code flow
- explicit sharing disclosure
- Notification Access deep-link
- content-sharing choice
- persistent monitoring status

## Stage 3 — Capture
Implemented:
- NotificationListenerService
- notification normalization
- own-app filtering
- local SQLite queue

## Stage 4 — Reliability
Implemented:
- retry queue
- periodic sync
- boot/package-replaced rescheduling
- heartbeat
- duplicate-safe ingestion

## Stage 5 — SaaS API
Implemented:
- tenant auth
- devices
- notification CRUD
- audit trail
- retention settings

## Stage 6 — Parent UI
Implemented:
- marketing site
- dashboard
- notifications
- devices
- settings
- billing
- legal pages

## Stage 7 — Realtime
Implemented:
- SSE event stream

## Stage 8 — Security
Implemented:
- password hashing
- sessions
- CSRF
- token hashing
- content encryption
- rate limiting
- verified payment webhooks

## Stage 9 — Reliability/operations
Implemented:
- health endpoint
- retention worker endpoint
- Docker
- Nginx
- backup/operational docs
- static validation script

## Stage 10 — Release readiness
Included:
- Play compliance checklist
- release configuration
- production deployment docs
- test placeholders
- explicit verification boundaries

Device and live payment verification remain external pre-launch validation steps.
