# KidRaksha — Final-product SaaS architecture

KidRaksha is a notification-sharing parental-control SaaS, not a developer demo. Every stage is designed as one production product.

## Parent SaaS
- Public marketing and pricing
- Account signup/login
- Multi-tenant sessions
- Overview dashboard
- Notification inbox with search/read/delete
- Child device pairing and revocation
- Billing and verified provider webhooks
- Retention controls
- Privacy/legal pages
- Account deletion endpoint

## Child app
- Branded onboarding
- One-time parent pairing code
- Prominent notification-data disclosure before access
- Android Notification Access settings handoff
- Optional message-content sharing
- Persistent KidRaksha status notification
- Offline local queue with encrypted notification content
- Retry and periodic synchronization
- Secure device token in Android Keystore
- Fail-closed behavior when visible status cannot be displayed

## Product boundary
No camera, microphone, location, accessibility, VPN, screen capture, SMS/call logs, stealth monitoring, or hidden permission bypass is included.

## External launch checks
The repository is prepared for final validation, but a production release still requires an actual Android build/device test, Play Console declarations, payment-provider test/live verification, HTTPS deployment, database restore testing, and legal review of privacy/consumer terms for the markets served.
## Reliability foundation

Stage 4 uses WorkManager for durable child-to-cloud synchronization. Notification delivery is at-least-once locally and idempotent on the server, with bounded offline retention and parent-visible sync health.
