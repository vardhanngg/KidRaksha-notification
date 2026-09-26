
# Product specification

## Positioning

KidRaksha is a SaaS parental-control product focused on notification visibility. It is not marketed as a spy or secret-surveillance tool.

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
  → User enables KidRaksha
  → Choose whether message content is shared
  → Sharing starts
  → Persistent KidRaksha notification remains visible
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

The product offers a 7-day trial and two paid options for one child device. Prices and limits are configuration/data, not hard-coded entitlements in the Android application.

Current paid options:
- Weekly: ₹79/week, 7-day notification retention
- Monthly: ₹199/month, 30-day notification retention
- No annual subscription is offered

## Notification model

The server keeps:
- source application package and display name
- notification title
- optional notification body
- event timestamps
- read state
- child device association

Content is encrypted at rest. Search operates on non-content metadata by default.
