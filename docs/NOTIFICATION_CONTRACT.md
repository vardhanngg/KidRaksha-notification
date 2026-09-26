# Notification Contract — v3

The child device sends a batch of normalized notification records to `POST /v1/device/notifications`.

## Required fields

- `clientNotificationId`: SHA-256 id derived from the hashed Android notification key and post time.
- `notificationKeyHash`: SHA-256 of Android's notification key. The raw key never leaves the device.
- `packageName`: source application package.
- `appName`: user-visible application label when Android exposes it.
- `notificationType`: normalized category such as `message`, `email`, `call`, `media`, `alarm`, `system`, or `other`.
- `contentState`: `available`, `withheld`, or `unavailable`.
- `postedAt`: ISO-8601 timestamp from Android.

## Optional metadata

`category`, `channelId`, `groupKey`, `isOngoing`, `isClearable`, and `isGroupSummary` are preserved so the SaaS can later support filtering without needing to change the child protocol again.

## Content rules

When message-content sharing is disabled, title and body are omitted and the server canonicalizes `contentState` to `withheld` regardless of the value claimed by the child. When content sharing is enabled but Android exposes no readable title/body, the server records `unavailable`.

## Privacy rule

Sensitive text is never placed in identifiers. The content itself is encrypted in the Android offline queue and encrypted at rest in PostgreSQL.
