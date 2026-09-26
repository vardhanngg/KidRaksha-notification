# KidRaksha API Contract

Stage 5 establishes the production API contract used by the parent SaaS and child Android client.

## Base

All application endpoints use `/v1`. Browser requests are normally made through the Next.js `/api/*` rewrite. Responses use JSON and include an `X-Request-ID` response header.

Mutating parent-browser endpoints require the CSRF double-submit token. Child endpoints use the paired device bearer token.

## Authentication

- `POST /v1/auth/signup`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/auth/session`

Parent sessions use an HttpOnly `kidraksha_session` cookie and a separate `kidraksha_csrf` cookie for CSRF protection.

## Product metadata and health

- `GET /v1/meta` — API/contract versions, supported capabilities and hard page/batch limits.
- `GET /health`
- `GET /v1/health` — database health and latency without exposing tenant data.

## Notifications

### List

`GET /v1/notifications`

Query parameters:

- `limit` — 1..100, default 50.
- `cursor` — opaque cursor returned by the previous page.
- `search` — searches app name, package name, child-device name, notification type and category.
- `unread=1` — only unread notifications.
- `deviceId` — UUID for a single child device.
- `type` — normalized notification type.
- `from` — inclusive ISO-8601 timestamp.
- `to` — exclusive ISO-8601 timestamp.
- `offset` — legacy transitional mode, 0..5000. New clients should use `cursor`.

Ordering is always `received_at DESC, id DESC`. Cursor pagination is keyset-based and therefore remains stable when new notifications arrive. PostgreSQL documents that large offsets require skipped rows to be computed and recommends a deterministic `ORDER BY`; KidRaksha therefore treats cursor pagination as the long-term contract. citeturn335036search2

Example response shape:

```json
{
  "items": [],
  "pageSize": 50,
  "hasMore": true,
  "nextCursor": "opaque-value",
  "pagination": {
    "type": "cursor",
    "cursor": "opaque-value",
    "offset": null,
    "maxPageSize": 100,
    "maxOffset": 5000
  },
  "searchScope": [
    "app_name",
    "package_name",
    "device_name",
    "notification_type",
    "category"
  ]
}
```

Notification title/body are encrypted at rest, so they are intentionally **not** included in server-side text search. Parent UI search should communicate that scope instead of implying message-content search exists.

### Single notification and lifecycle

- `GET /v1/notifications/:id`
- `POST /v1/notifications/:id/read`
- `POST /v1/notifications/:id/unread`
- `DELETE /v1/notifications/:id`
- `POST /v1/notifications/bulk-read` — max 100 IDs.
- `POST /v1/notifications/bulk-delete` — max 100 IDs.
- `POST /v1/notifications/read-all`

Deletion is soft deletion from the SaaS view. Retention maintenance permanently purges aged records.

Every object-level operation is constrained by the authenticated parent ID. OWASP explicitly calls out object-level authorization as a central API security requirement. citeturn335036search13turn335036search1

## Devices

- `GET /v1/devices`
- `GET /v1/devices/:id`
- `PATCH /v1/devices/:id` — rename; strict body schema.
- `POST /v1/devices/:id/rename` — legacy compatibility endpoint.
- `POST /v1/devices/:id/revoke`
- `DELETE /v1/devices/:id` — lifecycle-friendly revoke alias.
- `POST /v1/devices/pairing-codes`
- `DELETE /v1/devices/pairing-codes/:id`

`GET /v1/devices` returns an explicit `status` (`online`, `offline`, `revoked`) and `sync_status` (`healthy`, `pending`, `error`, `stale`). Revoked devices are excluded unless `includeRevoked=1` is requested.

## Audit

`GET /v1/audit`

Supports cursor pagination and optional `action`/`deviceId` filters. Audit metadata is tenant-scoped and excludes request bodies/secrets.

## Billing and entitlements

- `GET /v1/billing/plans`
- `GET /v1/billing/status`
- `POST /v1/billing/subscription`
- `POST /v1/billing/webhook`

The server distinguishes:

- `trial` — trial entitlement is still active.
- `paid` — paid subscription is active and within the current period.
- `expired` — there is no active entitlement.
- `none` — no subscription row exists.

Expired trials no longer grant device or notification-ingestion entitlements. Browser state cannot activate a paid plan; paid access is determined from verified subscription state, and webhook processing is idempotent by provider event ID.

## Child device API

- `POST /v1/device/pair`
- `POST /v1/device/unpair`
- `GET /v1/device/status`
- `POST /v1/device/heartbeat`
- `POST /v1/device/notifications`

Notification ingestion requires both valid device authentication and an active parent entitlement. The upload endpoint accepts at most 50 notifications per request and enforces the existing server body limit.

## Realtime event stream

`GET /v1/events/stream`

The parent console uses an authenticated Server-Sent Events stream for one-way server-to-browser updates. SSE is appropriate here because the browser only needs to receive events; MDN documents that `EventSource` automatically reconnects when the connection closes and supports event `id`, `retry` and `Last-Event-ID` state. citeturn821241search0turn821241search2

The stream:

- requires an authenticated parent session cookie;
- emits named events with a monotonic database-backed `id`;
- accepts the browser `Last-Event-ID` header automatically and also supports `?since=<id>` for a full-page reload/session cursor;
- replays retained parent-scoped events in ascending order;
- buffers new live events while a reconnect replay is in progress so event order cannot be inverted;
- emits `resync.required` when retained history cannot satisfy the cursor or the replay limit is exceeded; clients must then refresh authoritative REST data;
- emits a keep-alive comment every 20 seconds;
- limits each parent to 5 concurrent realtime connections.

Realtime events are delivery notifications only. The REST API and PostgreSQL tables remain the source of truth. Event history is retained for 7 days and is not used as the notification data-retention policy.

Current event names include `notification`, `notification.read`, `notification.unread`, `notifications.read-all`, `notifications.bulk-read`, `notification.deleted`, `notifications.bulk-deleted`, `device.paired`, `device.updated`, `device.revoked`, and `device.sync.updated`. Event payloads deliberately exclude decrypted notification title/body content.

Nginx must disable proxy buffering for this endpoint and allow a long read timeout. Node's HTTP server keeps the stream open while periodic keep-alive bytes prevent intermediary idle timeouts. citeturn821241search1turn821241search5

## Errors

Errors have a stable minimum shape:

```json
{
  "error": "Human-readable message",
  "code": "stable_machine_code",
  "requestId": "request-id"
}
```

Validation errors use `code=invalid_request` and include only field paths/codes, not submitted secret values.

## Resource controls

The API applies endpoint-specific rate limits, bounded request bodies, bounded page sizes, bounded bulk operations and bounded child notification batches. OWASP identifies missing limits on records per page, batch operations and other resource dimensions as an API security concern. citeturn335036search11

The current Express stack runs with Helmet, TLS-required production configuration, input validation and rate limits. Express recommends TLS for sensitive APIs, Helmet for security headers, input validation, and protection against authorization brute force. citeturn872130search1


## Operations endpoints

- `GET /health/live` — liveness only; safe for process/container checks.
- `GET /health/ready` — readiness check for PostgreSQL and Redis.
- `GET /healthz` — production edge health endpoint exposed by Nginx.
- `GET /v1/meta` — API/contract feature metadata for compatibility diagnostics.

The API does not run schema migrations during normal application startup. Production deployments run the dedicated migration job first.
