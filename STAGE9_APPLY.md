# Stage 9 apply guide

Run these commands from the root of the existing `KidRaksha-notification` repository after Stage 8 has been committed/merged.

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b stage-9-operations
```

Extract the Stage 9 ZIP at the repository root. Do not commit the ZIP itself.

```bash
unzip -o KidRaksha-notification-stage9-root.zip
rm -f KidRaksha-notification-stage9-root.zip
```

Validate:

```bash
git diff --check
bash scripts/check-product.sh
bash scripts/check-web-ui.sh
bash scripts/check-realtime.sh
bash scripts/check-security.sh
bash scripts/check-ops.sh

for f in services/api/src/*.js services/api/scripts/*.js; do node --check "$f"; done
for f in scripts/*.sh ops/*.sh; do bash -n "$f"; done
```

Review:

```bash
git diff --stat
git status
```

Commit:

```bash
git add -A
git commit -m "Stage 9: production operations and deployment"
git push -u origin stage-9-operations
```

The CI workflow will perform dependency installation, tests, web typecheck/build, Android tests/lint/build, Compose config validation and Docker image builds in GitHub Actions.

Do not deploy production until the environment secrets, TLS files, backup schedule, restore drill and external `/healthz` monitoring are configured as described in `docs/STAGE9_OPERATIONS.md`.
