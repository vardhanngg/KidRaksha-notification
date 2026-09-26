
# Architecture

## Tenant boundary

A parent account is the security tenant. Every device and notification row is linked to `parent_id`, and all parent-facing queries require the authenticated tenant ID.

## Authentication

Web:
- random opaque session token
- only SHA-256 hash stored server-side
- HttpOnly cookie
- SameSite=Lax
- Secure in production
- CSRF token required for state-changing browser calls

Child:
- random device bearer token generated only by the server
- SHA-256 hash stored server-side
- plaintext token stored in Android Keystore-backed encrypted preferences

## Pairing

1. Parent creates an 8-character short-lived pairing code.
2. Only a hash of the code is stored.
3. Child submits the code and device name.
4. Code is consumed once.
5. API returns a device token once.
6. Parent sees the device immediately.

## Notification ingestion

The Android listener writes to a SQLite pending queue before network transmission.

```text
NotificationListenerService
        ↓
Normalize
        ↓
SQLite pending queue
        ↓
Background uploader
        ↓
POST /v1/device/notifications
        ↓
Encrypted PostgreSQL row
        ↓
SSE broadcast
        ↓
Parent browser
```

## Realtime

Server-Sent Events are used for one-way parent updates. This keeps the parent portal simple and does not create a persistent bidirectional channel when it is unnecessary.

## Billing

Razorpay subscription objects are created server-side. Webhook events are verified using the provider secret, deduplicated and persisted before entitlement changes.

## Retention

A periodic job calls the database retention routine. Notification content older than the tenant retention window is deleted.
## Stage 4 synchronization

The Android client uses WorkManager rather than custom repeating alarms/receivers for persistent network synchronization. Immediate sync is unique work with a connected-network constraint; periodic reconciliation is a 15-minute minimum cadence and remains subject to OS scheduling/Doze. The server enforces `(device_id, client_notification_id)` idempotency.


## Stage 7 realtime path

```text
Postgres mutation
     │
     ├── authoritative table
     └── realtime_events row
              │
              ▼
       parent-scoped SSE
              │
              ▼
     RealtimeProvider (web)
        │       │
        │       └── reconnect / resync
        ▼
 dashboard / inbox / devices / onboarding
        │
        └── REST reconciliation
```

The event log provides recovery, not primary state. A browser can miss an event, receive it more than once after reconnect, or be forced to resync; pages therefore always treat REST responses as authoritative.
