
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

Stage 1 and Stage 2 are implemented. The repository is now a KidRaksha-branded SaaS baseline with secure parent authentication, final-product onboarding/pairing, a guided Android setup flow, realtime pairing events, and the notification-sharing foundation. Stage 3 is the next implementation stage.

## Product direction
KidRaksha is built as a production-oriented SaaS from the beginning: parent accounts, tenant isolation, subscription entitlements, pairing, notification delivery, privacy controls, child-device transparency, and an operator-ready deployment path are part of one coherent architecture.


Production account creation records acceptance timestamps for the Terms and Privacy Policy, and the SaaS console provides data export and account deletion controls.

### Stage 3

The notification engine now normalizes Android notification metadata, protects notification-key identity with hashing, keeps sensitive content out of identifiers, handles content availability explicitly, and drains the encrypted offline queue in bounded batches.
