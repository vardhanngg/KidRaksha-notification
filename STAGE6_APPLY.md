# Stage 6 apply

Stage 6 completes the parent-facing SaaS UI on top of the Stage 5 API.

## Branch

```bash
git checkout -b stage-6-parent-ui
```

## Apply

Extract `KidSuraksha-notification-stage6-root.zip` at the repository root.

## Verify

```bash
git diff --check
bash scripts/check-product.sh
bash scripts/check-web-ui.sh
node --check services/api/src/server.js
node --check services/api/src/auth.js
node --check services/api/src/billing.js
npm install
npm --workspace @kidraksha/web run typecheck
npm --workspace @kidraksha/web run build
```

The final two commands require the normal web dependencies and are the authoritative Codespace/CI validation for the Next.js application.

## Commit

```bash
git add -A
git status
git commit -m "Stage 6: complete parent SaaS UI"
git push -u origin stage-6-parent-ui
```

Review the branch/PR before merging to `main`.
