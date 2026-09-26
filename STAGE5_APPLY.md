# Stage 5 apply

Stage 5 is designed to be extracted at the repository root on top of the Stage 4 baseline.

```bash
git checkout -b stage-5-saas-api
unzip -o KidRaksha-notification-stage5-root.zip

git diff --check
bash scripts/check-product.sh
node --check services/api/src/server.js
node --check services/api/src/auth.js
node --check services/api/src/entitlements.js
node --check services/api/src/pagination.js
node --check services/api/src/logger.js
node --test services/api/test/*.test.js

git status
git add -A
git commit -m "Stage 5: complete SaaS API contract"
git push -u origin stage-5-saas-api
```

Do not commit the Stage 5 delivery ZIP itself. If you uploaded it into the Codespace, remove it before `git add -A`.
