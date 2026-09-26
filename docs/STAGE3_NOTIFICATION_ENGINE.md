# Stage 3 — Production Notification Engine

## Goal

Turn Android notification capture into a reliable, privacy-aware ingestion pipeline suitable for the KidRaksha SaaS product.

## Android

- `NotificationListenerService` remains the only notification-access capability.
- Listener callbacks return immediately to a dedicated executor because Android documents `onNotificationPosted` as a main-thread callback.
- `NotificationNormalizer` converts platform notifications into a stable contract.
- Text extraction uses title, conversation title, big text, normal text, summary text, and text-line fallbacks.
- App labels are cached to avoid repeated package-manager lookups.
- Notification keys are SHA-256 hashed before leaving the device.
- A stable client ID is derived from the hashed notification key and Android post time, so repeated callbacks for the same posted notification deduplicate without hashing sensitive notification text into an identifier.
- `contentState` is one of `available`, `withheld`, or `unavailable`.
- Notification category/type metadata is normalized for future SaaS filtering.
- Group summaries, ongoing state, clearability, channel ID and group key are preserved as metadata; they are not silently discarded.
- Offline rows remain in the encrypted SQLite queue until the server confirms acceptance.
- Sync drains up to ten 50-item batches per run and keeps retrying through the existing scheduled sync.
- Listener disconnects request an Android rebind rather than immediately turning sharing off, which avoids treating transient framework disconnects as permanent consent changes.

## Backend

Each accepted notification stores:

- package/app identity
- notification type/category
- hashed notification key
- channel/group metadata
- ongoing/clearable/group-summary flags
- encrypted title/body
- explicit content state
- posted/received timestamps

The API enforces the same content-sharing policy server-side. When content sharing is disabled, title/body are dropped even if a malformed or stale child request claims they are available.

## Android 15+ behavior

Android 15 can redact one-time passcodes from untrusted notification listeners and can hide notification content during screen sharing. KidRaksha does not attempt to bypass those platform protections; such fields are represented as unavailable when Android does not expose readable content.

## Privacy

The child app does not transmit raw Android notification keys. Message content remains encrypted in the local queue and at rest in PostgreSQL. Product UI distinguishes content that was intentionally withheld from content that Android did not expose.

## Test strategy

Pure text normalization and category classification are covered by JVM unit tests. Device-level tests remain part of the final end-to-end validation phase because they require a real Android environment.
