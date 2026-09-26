
# KidRaksha — Notification Sharing SaaS

KidRaksha is a consent-based parental notification sharing service.

The product is intentionally focused on one job: a parent can pair a child's Android device and view notifications shared from that device in a secure SaaS dashboard.

## Product architecture

```text
                       KidRaksha SaaS
       ┌───────────────────────────────────────────┐
       │ Parent Web App                            │
       │ Dashboard · Notifications · Devices       │
       │ Billing · Settings · Privacy              │
       └───────────────────┬───────────────────────┘
                           │ HTTPS / SSE
                           ▼
       ┌───────────────────────────────────────────┐
       │ API                                       │
       │ Auth · Pairing · Notifications · Billing  │
       │ Audit · Retention · Realtime              │
       └───────────────────┬───────────────────────┘
                           │
                           ▼
                    PostgreSQL
                           ▲
                           │ HTTPS
                           │
       ┌───────────────────┴───────────────────────┐
       │ Child Android App                         │
       │ NotificationListenerService               │
       │ Secure token · local queue · sync         │
       └───────────────────────────────────────────┘
```

## Monorepo

- `apps/web` — Next.js SaaS portal and marketing site
- `apps/android` — Android child application
- `services/api` — Express API and PostgreSQL integration
- `infra` — Docker Compose and Nginx
- `docs` — product, security, deployment and Play policy notes

## Product principles

1. Parent-only monitoring use case.
2. Explicit child-device disclosure and user-controlled Notification Access.
3. Persistent monitoring notification while sharing is active.
4. No stealth mode or hidden collection.
5. Store notification content encrypted at rest.
6. Store device tokens only as one-way hashes on the server.
7. Use tenant-scoped SQL access on every parent request.
8. Billing status is activated by verified provider webhooks, not browser claims.
9. Retention is configurable.
10. Every destructive or security-sensitive action is auditable.

## Local development

### Backend

```bash
cd services/api
cp .env.example .env
npm install
npm run dev
```

### Web

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

### Android

Open `apps/android` in Android Studio or build with the included Gradle configuration after setting the API URL.

For local emulator development, the Android debug flavor defaults to `http://10.0.2.2:4000` when `KIDRAKSHA_API_URL` is not supplied.

## Production

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

Put Nginx behind TLS or a managed load balancer and set the production secrets described in `docs/DEPLOYMENT.md`.

## Important verification note

This repository was statically reviewed and generated as a complete product foundation. Device-level Android testing and a live payment-provider account are external validation steps and are not represented as completed here.

## Current build status

Stages 1–9 are implemented. The repository now includes the KidRaksha SaaS foundation, secure pairing, production notification normalization, durable WorkManager synchronization, offline queue handling, server idempotency, parent-visible sync health, the completed SaaS API contract, the polished parent UI, reconnect-safe realtime updates, Stage 8 security/privacy hardening, and Stage 9 production operations/deployment tooling. Device-level Android testing and live production verification remain final pre-launch checks.

### Stage 9 operations
The deployment stack now separates migrations and maintenance from the API process, uses liveness/readiness probes, non-root containers, production Nginx/TLS configuration, backup/restore tooling, and protected staging/production deployment workflows. See `docs/STAGE9_OPERATIONS.md` and `docs/DEPLOYMENT.md`.

## Product direction
KidRaksha is built as a production-oriented SaaS from the beginning: parent accounts, tenant isolation, subscription entitlements, pairing, notification delivery, privacy controls, child-device transparency, and an operator-ready deployment path are part of one coherent architecture.


Production account creation records acceptance timestamps for the Terms and Privacy Policy, and the SaaS console provides data export and account deletion controls.

### Stage 7 realtime

The parent console uses one authenticated Server-Sent Events connection per open console tab. Events are durably recorded with monotonic IDs, replayed after reconnect using `Last-Event-ID`/session cursor state, and buffered during replay so live events cannot overtake missed events. Realtime is never the data source of truth; dashboard, inbox and device pages reconcile from the REST API after reconnect/resync.

### Stage 3

The notification engine now normalizes Android notification metadata, protects notification-key identity with hashing, keeps sensitive content out of identifiers, handles content availability explicitly, and drains the encrypted offline queue in bounded batches.


## Stage 4 reliability
Notification synchronization uses WorkManager for persistent background execution, with network constraints, exponential backoff, server idempotency, and sync health telemetry. See `docs/STAGE4_RELIABILITY.md`.


## Current stage

Stage 9 completes the production-oriented operations and deployment foundation. See `docs/STAGE9_OPERATIONS.md`, `docs/STAGE9_VERIFICATION.md`, and `STAGE9_APPLY.md`.

Stage 6 application and verification steps remain in `STAGE6_APPLY.md`.
Stage 8 application and verification steps remain in `STAGE8_APPLY.md`.
Stage 9 application and verification steps are in `STAGE9_APPLY.md`.

### Stage 8 security & privacy
The SaaS now uses production host-scoped session cookies, server-side idle/absolute expiry, CSRF and Origin/Fetch-Metadata defenses, password rehashing and reauthentication, versioned AES-256-GCM notification encryption with key rotation support, Redis-backed distributed rate limits, hardened browser headers, Android backup/screenshot protections, secure logout/session revocation, and explicit export/deletion controls. See `docs/STAGE8_SECURITY_PRIVACY.md` and `SECURITY.md`.
