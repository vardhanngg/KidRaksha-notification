# Stage 8 — Apply & verify

## Apply

From the repository root in Codespaces:

```bash
git checkout main
git pull origin main
git checkout -b stage-8-security-privacy
unzip -o KidSuraksha-notification-stage8-root.zip
rm -f KidSuraksha-notification-stage8-root.zip
```

## Static verification

```bash
git diff --check
bash scripts/check-product.sh
bash scripts/check-web-ui.sh
bash scripts/check-realtime.sh
bash scripts/check-security.sh
node --check services/api/src/server.js
node --check services/api/src/auth.js
node --check services/api/src/crypto.js
node --check services/api/src/rate-limit.js
node --check services/api/src/billing.js
node --check apps/web/next.config.mjs
```

## Dependency-backed verification in Codespaces/CI

```bash
npm install
npm --workspace @kidraksha/api test
npm --workspace @kidraksha/web run typecheck
npm --workspace @kidraksha/web run build
```

## Commit

```bash
git status
git diff --stat
git add -A
git commit -m "Stage 8: security and privacy hardening"
git push -u origin stage-8-security-privacy
```

Do not commit the delivery ZIP itself.

## Important deployment note

Stage 8 changes production session cookie names to `__Host-kidraksha_session` and `__Host-kidraksha_csrf`, so the first deployment will require existing browser sessions to sign in again.
