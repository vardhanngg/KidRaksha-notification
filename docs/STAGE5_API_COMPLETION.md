# Stage 5 — SaaS API Completion

Stage 5 turns the Stage 4 backend into a stable production SaaS API contract.

## Delivered

### Pagination and search

Notifications now support opaque keyset cursors ordered by `received_at DESC, id DESC`. The legacy offset mode remains available for compatibility but is bounded to 5,000 rows. Search is explicit about its scope because notification title/body are encrypted and therefore cannot be searched with ordinary SQL text indexes.

### Notification lifecycle

The API now supports single and bounded bulk read/unread/delete operations, single-notification retrieval, object-level authorization, and realtime lifecycle events without leaking notification body content through the event stream.

### Device lifecycle

Device collection can distinguish active versus revoked records, return derived online/sync state, expose a device detail endpoint, use a REST-style `PATCH` rename endpoint, and revoke via `DELETE` as well as the legacy action endpoint.

### Subscription entitlements

Subscription state is centralized in `entitlements.js`. Expired trials have zero active entitlements. Pairing and notification ingestion require an active entitlement, while device revocation/status and billing remain accessible so an account can recover cleanly.

Subscription creation uses a per-parent PostgreSQL advisory lock to prevent concurrent browser requests from creating multiple provider subscriptions for the same account. Verified provider webhooks remain the source of paid-access activation.

Razorpay's subscription model uses lifecycle webhooks such as activation, payment success, pending/failure and halt states; KidRaksha keeps the provider event handling idempotent and does not treat browser checkout state as authorization. citeturn872130search2

### Observability

Every response includes `X-Request-ID`, structured request/failure logs use Pino, health reports database latency, and API errors return a request ID plus a stable machine code. Request logs intentionally omit cookies, authorization headers, and request bodies.

Express recommends structured logging and production reliability controls rather than synchronous console logging in the request path. citeturn872130search0

### Dependency baseline

Stage 5 aligns the server validation/rate-limit/logging baseline with current package releases verified during implementation:

- Zod 4.6.5
- express-rate-limit 8.7.0
- Pino 10.3.1

These are implementation dependencies only; the API contract remains versioned separately.

## Known platform constraint

The server uses an in-process rate-limit store for the current single-instance deployment. A multi-instance production rollout should move rate-limit state to a shared external store. That belongs in the Stage 9 operations hardening work.
