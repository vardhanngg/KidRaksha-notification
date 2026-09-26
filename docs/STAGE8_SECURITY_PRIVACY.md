# Stage 8 — Security & Privacy Hardening

## Security boundary

KidRaksha uses a server-side parent session in an HttpOnly, Secure, SameSite=Strict `__Host-` cookie in production. The browser never stores an authentication token in localStorage/sessionStorage. CSRF tokens are double-submitted from a public cookie and are stored hashed server-side; pre-Stage-8 sessions are upgraded lazily.

Parent state-changing requests also validate their Origin against `PUBLIC_WEB_ORIGIN` in production.

## Passwords

New passwords use scrypt with N=2^17, r=8, p=1. Existing weaker hashes are accepted only for migration and are rehashed after successful login.

## Sessions

Sessions have a 14-day absolute expiration and an 8-hour inactivity timeout. Long-lived realtime streams refresh session activity while connected and close when the server-side session is revoked or expires. Sensitive billing and account-deletion operations require the current password; successful password verification refreshes a 15-minute reauthentication window for subsequent sensitive operations. Logout/account deletion clear session cookies and request browser-side site data cleanup.

## Encryption

Notification content is encrypted with AES-256-GCM. New ciphertexts carry a version marker. `DATA_ENCRYPTION_KEY_PREVIOUS` permits a controlled key-rotation window while new data always uses the current key.

Device tokens remain hashed on the server. Android uses Android Keystore-backed AES-GCM for device credentials and local queued notification content; application data and the offline queue are excluded from backup/device transfer. Android recommends Android Keystore for long-term protection of cryptographic keys.

## Rate limiting

Production rate limiting uses Redis so limits are shared across API instances. Development can use the built-in memory store when `REDIS_URL` is absent; production requires Redis and blocks startup if Redis cannot be connected.

## Browser hardening

The parent web app sends CSP, HSTS (production), frame protections, no-referrer, resource-policy and permissions-policy headers. Razorpay checkout is allowlisted explicitly rather than opening broad script/connect/frame sources.

## Data minimization

Account creation audit metadata no longer records the parent email. Billing webhook storage keeps only the subscription identifier needed for idempotency/diagnostics rather than the provider payload. Notification content is never written to application logs.

## High-risk actions

Account deletion and creation of a paid subscription require the current password. Parent device mutations remain CSRF- and tenant-authorized. Child device tokens are never accepted from a browser session.

## Platform/privacy alignment

The child app remains transparent: it uses the user-enabled Notification Listener, an explicit content-sharing choice, a visible KidRaksha status notification while sharing is active, and no hidden monitoring capability. Play's parental monitoring category and disclosure requirements must still be validated in the final Play Console submission.


### Password changes and sensitive exports

Password changes verify the current password, rotate the password hash using the current scrypt profile, invalidate all existing sessions, and create a fresh session for the current browser. Full account exports require recent reauthentication before notification and device data can be downloaded.


### Dependency and framework security posture

The web app is pinned to Next.js 16.3.6 and React 19.3.0 in this stage. On September 22, 2026, Next.js announced 16.3.6 as the current Active LTS security release; a further scheduled security release, including 16.3.7, was announced for September 30, 2026. The repository therefore includes Dependabot configuration, and the final release gate must re-check the framework versions immediately before deployment.

Production CSP does not include `unsafe-eval`; that allowance is limited to development.

## Deployment notes

Stage 8 changes the production session cookie names to `__Host-kidraksha_session` and `__Host-kidraksha_csrf`. Existing production browser sessions will therefore require one fresh login after deployment; this is intentional and prevents legacy cookie scope from surviving the security hardening.

The API baseline uses Express 5.2.1. Keep dependency updates enabled through Dependabot and apply the current patched Next.js release before each public release. As of 26 September 2026, Next.js 16.3.6 is the patched Active LTS release; the project deliberately does not pin a not-yet-released future patch.
