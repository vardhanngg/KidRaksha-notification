# Stage 6 Verification

## Static verification

The following checks are required before the Stage 6 branch is merged:

```bash
bash scripts/check-product.sh
bash scripts/check-web-ui.sh
```

The API source is also checked independently:

```bash
node --check services/api/src/server.js
```

For the web source, the repository should run its normal Next.js typecheck/build once dependencies are installed:

```bash
npm install
npm --workspace @kidraksha/web run build
```

## Regression checks performed during Stage 6 development

- Removed all raw browser `alert`, `confirm`, and `prompt` usage from the web UI.
- Kept the primary notification list on cursor pagination.
- Verified the revoke/delete flows use explicit confirmation dialogs.
- Added route-level loading/error states.
- Added mobile navigation and responsive content breakpoints.
- Preserved the Stage 5 API contract for notifications, devices, settings, billing and account export/deletion.
- Kept `Permissions-Policy` camera/microphone/geolocation restrictions from the existing Next.js headers.
- Added keyboard focus, skip-link and reduced-motion handling.
- Ran the Stage 6 web UI checker and source-level parsing before packaging.

## Environment limitation

This build environment does not contain the web application's `node_modules`, so a real Next.js production build cannot be truthfully marked as passed here without installing the dependencies. The release process must repeat that build in the GitHub Codespace/CI environment.
