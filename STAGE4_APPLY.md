# Stage 4 — Apply Guide

Stage 4 replaces the old custom repeating sync receivers with WorkManager and adds durable notification synchronization, retry/backoff, idempotent delivery, bounded offline retention, and parent-facing sync health.

## 1. Create the branch

```bash
git checkout -b stage-4-reliable-sync
```

## 2. Apply this package at the repository root

Extract the Stage 4 package directly into `/workspaces/KidSuraksha-notification`. It should merge into the existing `apps/`, `services/`, `docs/`, `infra/`, `ops/`, and `scripts/` trees. Do not keep the delivery ZIP inside the Git repository.

## 3. Static validation

```bash
git diff --check
bash scripts/check-product.sh
node --check services/api/src/server.js
node --check services/api/src/auth.js
node --check services/api/src/db.js
```

`check-product.sh` must report `KidSuraksha product structure check: PASS`.

## 4. Review the migration

Stage 4 adds `services/api/db/migrations/004_sync_reliability.sql` and `005_sync_overflow.sql`. The normal database initialization/migration path applies them in lexical order.

## 5. Review the Git diff

```bash
git status
git diff --stat
git diff -- apps/android/app/src/main/java/com/kidraksha/child/sync/NotificationSyncWorker.kt
git diff -- services/api/src/server.js
```

## 6. Commit and push

```bash
git add -A
git commit -m "Stage 4: reliable notification synchronization"
git push -u origin stage-4-reliable-sync
```

## 7. Important testing note

The repository includes source-level/static validation, but a full APK build/device test still requires a working Android SDK/Gradle dependency cache. Do not treat the absence of that environment as a successful mobile build.
