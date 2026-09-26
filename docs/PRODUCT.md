
# Product specification

## Positioning

LittleWatch is a SaaS parental-control product focused on notification visibility. It is not marketed as a spy or secret-surveillance tool.

## Core journey

### Parent

```text
Landing page
  → Sign up
  → 7-day trial
  → Dashboard
  → Add child device
  → Generate pairing code
  → Child enters code
  → Device connected
  → Notifications appear in real time
```

### Child device

```text
Install
  → Explain what will be shared
  → Pair
  → Open Android Notification Access
  → User enables LittleWatch
  → Choose whether message content is shared
  → Sharing starts
  → Persistent LittleWatch notification remains visible
```

## SaaS areas

- Overview
- Notifications
- Devices
- Billing
- Settings
- Privacy / Terms
- Onboarding
- Support-ready empty/error states

## Plans

The product model contains starter and family tiers. Prices and limits are configuration/data, not hard-coded entitlements in the Android application.

Example defaults:
- Trial: 7 days
- Starter: 1 child device
- Family: 4 child devices
- Retention: 7 / 30 / 60 / 90 days

## Notification model

The server keeps:
- source application package and display name
- notification title
- optional notification body
- event timestamps
- read state
- child device association

Content is encrypted at rest. Search operates on non-content metadata by default.
