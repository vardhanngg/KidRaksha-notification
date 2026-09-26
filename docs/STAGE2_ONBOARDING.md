# Stage 2 — Onboarding & Secure Pairing

## Goal

Connect an Android child device to one authenticated parent account without introducing hidden monitoring or a developer-only bootstrap path.

## Parent journey

```text
Parent signs in
      ↓
Family setup
      ↓
Create pairing code
      ↓
10-minute countdown
      ↓
Enter code on Android
      ↓
Device paired event
      ↓
Parent sees connected device
```

The code is eight characters from a reduced-ambiguity alphabet and is stored server-side only as a hash. The UI can cancel the active code and generate a replacement.

## Android journey

```text
Connect this device
      ↓
Enter parent pairing code
      ↓
Pairing succeeds
      ↓
How sharing works
      ↓
Enable Notification Access
      ↓
Allow KidRaksha status notification
      ↓
Turn on notification sharing
      ↓
Optional: enable message content
      ↓
Connected
```

Pairing does not itself enable notification sharing. The device user must explicitly enable Android Notification Access and then enable sharing inside KidRaksha.

## Server API added in Stage 2

```text
POST   /v1/devices/pairing-codes
DELETE /v1/devices/pairing-codes/:id
POST   /v1/device/pair
GET    /v1/device/status
POST   /v1/device/heartbeat
POST   /v1/devices/:id/rename
POST   /v1/devices/:id/revoke
GET    /v1/events/stream
```

`device.paired` is emitted over the authenticated parent SSE stream after the pairing transaction commits.

## Safety/platform design

KidRaksha uses Android's `NotificationListenerService` model. The service is declared with `BIND_NOTIFICATION_LISTENER_SERVICE`, and the setup UI sends the device user to Android's Notification Listener settings rather than attempting to bypass the system-controlled grant.

KidRaksha also keeps a visible status notification while sharing is active. The app fails closed if the notification listener access or the app's own required notification visibility is no longer available.

## Failure cases covered

- invalid/expired pairing code
- device-plan limit reached
- pairing code cancellation
- parent closes the browser while waiting
- realtime event unavailable (polling fallback)
- Notification Access denied
- app notification permission denied
- notification channel disabled
- user revokes Notification Access later
- parent revokes paired device
- network unavailable during pairing or first heartbeat
- unpair attempted while offline

## Future Stage 2+ extensions

QR-based pairing can be added later, but is intentionally not required for the core product because it introduces another camera/privacy permission and is not necessary for a secure one-time code flow.
