# Changelog

## Stage 2 — Onboarding & secure pairing
- Renamed product branding to KidRaksha and pre-release Android package/application identity.
- Added pairing-code IDs, expiry metadata, cancellation, device-paired realtime event, device status, and rename endpoints.
- Replaced basic child pairing UI with a guided setup state machine.
- Switched notification-access detection to NotificationManager.isNotificationListenerAccessGranted on supported API levels.
- Enforced visible status-notification readiness before notification sharing can be enabled.
- Added server-backed heartbeat immediately after successful pairing.
- Added parent onboarding countdown and realtime pairing confirmation with fallback polling.
- Added Android release-build guard requiring KIDRAKSHA_API_URL.


## 2026-09-26 — SaaS foundation hardening
- Built KidRaksha as a production-shaped notification-sharing SaaS monorepo.
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
