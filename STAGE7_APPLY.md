# Stage 7 apply guide

Run from the repository root.

```bash
git checkout -b stage-7-realtime
unzip -o KidSuraksha-notification-stage7-root.zip

git diff --check
bash scripts/check-product.sh
bash scripts/check-web-ui.sh
node --check services/api/src/server.js
node --check services/api/src/events.js
node --test services/api/test/*.test.js

# Optional, authoritative web checks after dependencies are installed:
npm install
npm --workspace @kidraksha/web run typecheck
npm --workspace @kidraksha/web run build

git status
git add -A
git commit -m "Stage 7: reconnect-safe realtime experience"
git push -u origin stage-7-realtime
```

The migration `services/api/db/migrations/007_realtime_events.sql` must be applied after migrations 001–003.

Do not copy the ZIP into the Git repository. The ZIP is a delivery artifact only.
