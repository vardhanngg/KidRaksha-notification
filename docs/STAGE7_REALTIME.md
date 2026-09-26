# Stage 7 — Realtime experience

Stage 7 turns the parent console into a live SaaS experience without making realtime transport the source of truth.

## Server design

`services/api/src/events.js` owns the realtime transport lifecycle:

- parent-scoped connection registry
- five-connection cap per parent
- SSE frame formatting
- event payload size bound (64 KiB)
- durable event creation in `realtime_events`
- ordered replay by monotonic `BIGSERIAL` ID
- bounded replay (200 events)
- `resync.required` recovery signals
- buffering of live events during replay
- 20-second keep-alive comments
- safe connection cleanup

The event stream is protected by the normal parent session authentication plus a dedicated connection rate limit. Nginx disables buffering for the stream.

## Event contract

Named events currently include:

- `notification`
- `notification.read`
- `notification.unread`
- `notifications.read-all`
- `notifications.bulk-read`
- `notification.deleted`
- `notifications.bulk-deleted`
- `device.paired`
- `device.updated`
- `device.revoked`
- `device.sync.updated`

Event payloads are deliberately metadata-only. Decrypted notification title/body values are not broadcast.

## Replay semantics

The browser normally relies on the SSE `Last-Event-ID` mechanism. On a full tab reload, the client also retains the most recent event ID in session storage and uses `?since=` to request replay.

On reconnect the API captures a replay snapshot, registers the client in buffering mode, replays all retained events after the cursor up to that snapshot, then flushes live events that arrived during replay. This avoids the classic race where a newly created event overtakes older replayed events.

If the requested cursor is older than retained history or the replay exceeds 200 events, the server sends `resync.required`. The web provider turns that into a reconciliation trigger; affected screens re-fetch their REST state.

## Browser behavior

`apps/web/lib/realtime/client.tsx` creates one EventSource per mounted parent console shell. Consumers subscribe through `useRealtimeEvent` or `useRealtimeRefresh`.

The provider tracks:

- `live`
- `connecting`
- `reconnecting`
- `offline`

Browser `online`/`offline` changes update the status and reconnect the stream when connectivity returns. A reconnect or resync causes active product pages to reconcile from REST.

## Scale guardrails

The stream is intentionally lightweight:

- max five simultaneous connections per parent
- max 200 replayed events per reconnect
- max 64 KiB event payload
- seven-day event-log retention
- one shared stream per open console tab
- bulk read/delete operations emit one coalesced event rather than one event per row

At higher scale, the in-memory connection registry can be replaced by a dedicated pub/sub layer without changing the browser contract. The current event table remains useful for replay and auditability.

## Reliability principle

Realtime is a UI accelerator. It must never be required for correctness. A missed event can only make the UI stale temporarily; reconnect/resync and normal REST loading restore authoritative state.
