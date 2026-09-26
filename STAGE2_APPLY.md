# Apply Stage 2 — KidRaksha

This package is intended to be applied to the existing `vardhanngg/KidRaksha-notification` repository after Stage 1.

## In the Codespace

1. Create a Stage 2 branch:

```bash
git checkout -b stage-2-onboarding-pairing
```

2. Copy this package over the repository root.

3. Review the change set:

```bash
git status
git diff --stat
git diff --check
```

4. Run the repository checks:

```bash
bash scripts/check-product.sh
node --check services/api/src/server.js
node --check services/api/scripts/init-db.js
```

5. Commit and push:

```bash
git add .
git commit -m "Stage 2: onboarding and secure pairing"
git push -u origin stage-2-onboarding-pairing
```

6. Merge the branch into `main` after review, or use the branch as the Stage 2 baseline.

## Android release URL

Release builds now require the Gradle property/environment variable:

```bash
-PKIDRAKSHA_API_URL=https://api.your-domain.example
```

The debug build keeps the emulator default `http://10.0.2.2:4000` unless overridden.

## Important

Stage 2 changes the pre-release Android package/application identity to `com.kidraksha.child`. Because the project has not been released/tested yet, this is intentionally being done before release rather than after a public package ID has been distributed.
