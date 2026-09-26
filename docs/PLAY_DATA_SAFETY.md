# Google Play Data Safety — draft

This is a **pre-filled engineering draft**, not a substitute for completing the Play Console form from the final production configuration. Reconfirm every answer at submission time.

## Data handled by the app

| Product data | Engineering basis | Likely Play category to review | Purpose | Encrypted in transit | User-controlled deletion |
|---|---|---|---|---|---|
| Name | Parent account | Personal info / Name | Account management | Yes | Yes |
| Email | Parent account + password recovery | Personal info / Email address | Account management, authentication | Yes | Yes |
| Notification title/body | Android NotificationListenerService, content sharing opt-in | Messages / other user content category — confirm exact Console label | Core notification-sharing feature | Yes | Yes |
| Notification app/package metadata | Android listener payload | App activity / other category — confirm exact Console label | Core notification-sharing feature | Yes | Yes |
| Device/account identifiers | Generated device UUID, session/device credentials | User IDs / device or other identifiers — confirm exact Console label | Pairing and authentication | Yes | Yes |
| Subscription information | Razorpay integration | Financial info / purchase history — confirm exact Console label | Subscription management | Yes | Yes |

## Not requested by the Android child app
- Precise location
- Contacts
- Camera
- Microphone
- SMS
- Call logs
- Advertising ID

## Sharing statement
Notification data is synchronized to KidRaksha infrastructure and shown to the authorized parent account. KidRaksha does not sell notification content or use it for advertising. Payment-provider data is handled through the subscription integration.

## Security
HTTPS is required in production. Notification content is encrypted at rest. Device tokens are stored as hashes server-side. Android queue contents use local encryption and backup exclusion.

## Deletion
The web console provides authenticated account deletion. The public deletion page is `/delete-account`. The production Data Safety answers must match the actual deployed build, backend providers, retention policy and legal entity.

## Verification references
Review the latest Google Play User Data, Data Safety, parental-monitoring and account-deletion requirements immediately before submission.
