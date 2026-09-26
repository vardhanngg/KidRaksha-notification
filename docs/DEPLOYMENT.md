
# Deployment

## Required services

- PostgreSQL 17+
- API container
- Next.js web container
- Nginx or a managed HTTPS reverse proxy

## Environment

Generate secrets with:

```bash
node services/api/scripts/generate-secret.js
```

Generate a 32-byte base64 key for `DATA_ENCRYPTION_KEY`.

## TLS

Terminate HTTPS at Nginx or a cloud load balancer. Set:
- `NODE_ENV=production`
- secure session cookies
- strict CSP/security headers at the edge
- HSTS after verifying the deployment

## Database

Back up PostgreSQL daily and test restore procedures.

## Billing

Create your Razorpay subscription plans in the provider dashboard, then place their IDs in:
- `RAZORPAY_PLAN_STARTER`
- `RAZORPAY_PLAN_FAMILY`

Configure the Razorpay webhook endpoint:

```text
https://your-domain.example/api/v1/billing/webhook
```

Use only test keys until end-to-end payment verification is complete.

## Android release

Build with:

```text
-PLITTLEWATCH_API_URL=https://api.your-domain.example
```

or set the Gradle property:

```text
-PLITTLEWATCH_API_URL=https://api.your-domain.example
```

Do not ship the placeholder production API URL.

## Operational readiness

Before launch:
- run the full API test suite
- run Android unit tests
- build release APK/AAB
- verify Play policy declarations
- verify privacy policy URL
- test subscription webhook replay
- test database restore
- rotate secrets in a staging environment
