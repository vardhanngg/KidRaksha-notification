# Stage 6 — Parent SaaS UI completion

Stage 6 turns the Stage 5 API into the customer-facing parent product. It is still the same Next.js 16 App Router application, but the UI is now organized around the final SaaS journey instead of prototype-style screens.

## Product surfaces

- Responsive parent console shell with desktop sidebar and mobile navigation drawer.
- Overview dashboard with notification, unread, retention and device-health summary cards.
- Notification inbox with cursor pagination, app/device/type filters, unread filtering, selection, bulk read/delete, notification detail, and clear empty/loading/error states.
- Device management with connection/sync health, secure-pairing CTA, rename dialog and revoke confirmation dialog.
- Billing screen with current-plan state, plan comparison, verified-provider messaging, and checkout loading/error states.
- Settings with retention controls, privacy/transparency summary, recent account activity, JSON export, and accessible account-deletion confirmation.
- Onboarding screen with a four-step mental model, one-time pairing code, copy feedback, expiry state, realtime pairing success and privacy reminder.
- Marketing, pricing and authentication surfaces share the same product identity and visual language.
- Route-level `loading.tsx` and `error.tsx` provide instant loading/error experiences for the protected console.

## Interaction rules

The UI does not use `window.alert`, `window.confirm` or `window.prompt`. Destructive actions use in-app dialogs and success/failure feedback uses toasts.

The notification inbox uses the Stage 5 cursor contract. It does not use offset pagination for the primary user journey.

The parent console is tenant-scoped by the Stage 5 API; the frontend never treats client-side state as an authorization boundary.

## Accessibility decisions

- Persistent visible keyboard focus using `:focus-visible`.
- Skip-to-content link on the parent console.
- Semantic navigation/main regions and explicit form labels.
- Dialogs use `role="dialog"` and `aria-modal` and close with Escape when not busy.
- Icon-only controls have accessible labels.
- Minimum interactive target sizing is designed around WCAG 2.2's 24×24 CSS-pixel target-size minimum, with larger controls for primary actions.
- Reduced-motion preference disables non-essential animations.

WCAG 2.2 recommends visible keyboard focus, focus-not-obscured behavior, and a 24×24 CSS-pixel minimum target size for pointer inputs at Level AA. See https://www.w3.org/TR/wcag/.

## Next.js decisions

The app remains on Next.js 16.3.6 and React 19.3.0 as established by the current repository. Next.js's current documentation says `loading.tsx` creates an instant loading state for a route segment and wraps the route content in a Suspense boundary. This stage uses that convention for the protected console.

See https://nextjs.org/docs/app/api-reference/file-conventions/loading and https://nextjs.org/docs/app/api-reference/components/link.

## Verification limits

Static checks can run without external services. Full browser rendering still needs a real Next.js dependency install and runtime environment. Android-device, production API, payment-provider and end-to-end verification remain in Stage 10.
