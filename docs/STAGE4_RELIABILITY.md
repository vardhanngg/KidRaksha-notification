# Stage 4 — Production Synchronization & Reliability

## Goal
Make child-to-cloud notification delivery durable across offline periods, process death, reboot, network failures, duplicate HTTP delivery, and temporary backend failures.

## Android scheduling
KidRaksha uses `androidx.work:work-runtime-ktx:2.12.0` with `CoroutineWorker`. WorkManager is the Android-recommended API for persistent background work and is designed to reschedule work across app restarts and reboots. A 15-minute periodic worker provides reconciliation; notification capture also enqueues unique one-time work for prompt delivery when a connected network is available.

Each work request requires `NetworkType.CONNECTED` and uses exponential backoff starting at 30 seconds. Unique work with `KEEP` prevents notification bursts from creating an unbounded number of sync jobs.

## Delivery semantics
The queue is **at-least-once**. A queued row is removed only after an HTTP success response. If the process crashes after the server commits but before local deletion, the same `clientNotificationId` is resent. The server's unique `(device_id, client_notification_id)` constraint turns that retry into a duplicate/no-op rather than a second notification.

This is intentional: exactly-once delivery cannot be guaranteed across an independently failing client and server without a distributed transaction. The system instead guarantees durable local retention plus server-side idempotency.

## Failure handling
- `2xx`: acknowledge/remove the batch.
- `408/425/429/5xx` and network I/O failures: retain queue and return `Result.retry()` so WorkManager applies exponential backoff.
- `401/403`: revoke local credentials/pairing because the server no longer accepts the device credential.
- `409`: server says sharing is disabled; local sharing is disabled and pending data is cleared because policy no longer permits upload.
- Other `4xx`: preserve the queue and record a local sync error; do not silently delete data.

## Queue behavior
The queue remains encrypted at rest. It is bounded to 5,000 rows to avoid unbounded disk consumption. If an unusually long offline period produces more than 5,000 queued notifications, the oldest queued rows are trimmed; the child app keeps a cumulative dropped-row counter and reports it to the parent so the product does not silently claim lossless delivery.

## Server observability
The device row now records:
- `last_sync_at`
- `pending_count`
- `sync_failures`
- `last_sync_error`
- `sync_dropped_count`

These are displayed in the parent Devices page so an account owner can distinguish an online device from a device that is online but struggling to synchronize.

## Platform research basis
Android documentation recommends WorkManager for persistent background work and specifically calls out periodic server synchronization as a WorkManager use case. Periodic work has a 15-minute minimum interval and can be delayed by Doze/battery optimization. Android 16 also applies JobScheduler runtime quotas to WorkManager jobs, so this design does not promise a precise 15-minute execution deadline or unlimited background runtime. WorkManager 2.12.0 was released September 23, 2026.

The Android build toolchain is aligned to AGP 9.3.1 + Kotlin Gradle Plugin 2.4.20 + Gradle 9.6.1. Kotlin's current compatibility table fully supports KGP 2.4.20 through AGP 9.3.1 and Gradle 9.7.0, while Android documents AGP 9.3 as requiring at least Gradle 9.5.0.
