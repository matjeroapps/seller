# Phase UI-5 Seller Portal Foundation

## Summary

Phase UI-5 transforms the Seller Portal frontend from the previous Vite SPA workspace into a Next.js App Router foundation. The implementation is intentionally limited to application architecture, Zitadel-compatible authentication scaffolding, protected routing, Seller shell composition, configuration-driven navigation, responsive layout readiness, RTL/LTR readiness, and UI SDK integration.

This phase does not implement Seller business functionality.

## Architecture Changes

- Replaced the `web/seller` Vite entrypoints with a Next.js application.
- Added App Router routes under `web/seller/app`.
- Added route groups for authentication and dashboard shell boundaries.
- Added `next.config.ts`, Tailwind configuration, PostCSS configuration, Vitest configuration, and Next type generation in local scripts.
- Added a root `npm run build` script so workspace builds can be validated from the Seller repository root.
- Removed old SPA-only Seller UI workflow files from `web/seller/src`.

## UX Design Process

Seller Portal has no official Stitch design for this phase, so the UX direction came from `ui-ux-pro-max`.

The selected pattern is a dense, accessible commerce operations dashboard:

- Seller workflows are organized around dashboard overview, catalog, orders, customers, storefront, analytics, and settings.
- Catalog is prepared as a parent information architecture group with products, variants, and inventory as future child destinations.
- The first dashboard screen uses high-scan summary cards and short operational readiness content.
- The visual system stays restrained and work-focused instead of marketing-led.

## ui-ux-pro-max Skill Usage

Command used:

```sh
python3 /var/www/personal/matjero/.agents/skills/ui-ux-pro-max/scripts/search.py "seller portal ecommerce dashboard foundation" --design-system --density 8 --variance 4 --motion 2 -p "MatjerHub Seller Portal"
```

Relevant output applied:

- Dense dashboard layout.
- Accessible and ethical UI direction.
- Clear focus rings.
- Keyboard-accessible controls.
- High-contrast light-mode foundation.
- Subtle motion and reduced-motion safeguards.
- Responsive targets for 390px, 768px, 1024px, and 1440px.

## Authentication Foundation

Added `web/seller/lib/auth`:

- `zitadel.ts`: Zitadel endpoint/config helpers, authorization URL builder, token exchange, and userinfo fetch.
- `pkce.ts`: server-side PKCE state, verifier, and challenge helpers.
- `session-cookie.ts`: middleware-safe session cookie parsing and serialization.
- `session.ts`: current session, current user, auth transaction, and logout helpers.
- `guards.ts`: `requireAuth` and optional user helpers.

Routes added:

- `/login`
- `/auth/callback`
- `/logout`

The session stores user identity, roles, tenant placeholder context, and expiry. It does not store access tokens, refresh tokens, ID tokens, prompts, or secrets in the browser cookie.

## Application Shell

Added `web/seller/components/shell/SellerShell.tsx` as the Seller-specific composition around the shared UI SDK `DashboardLayout`.

The shell provides:

- Sidebar navigation.
- Top navigation through the UI SDK shell.
- Breadcrumbs.
- Workspace label.
- User menu wiring.
- Sign-out route wiring.

## Navigation Architecture

Added `web/seller/config/seller-navigation.tsx`.

Navigation is configuration-driven and prepared for future role, permission, and tenant filtering:

- Dashboard
- Catalog
- Products
- Variants
- Inventory
- Orders
- Customers
- Storefront
- Analytics
- Settings

The phase does not add workflow pages for these destinations beyond the foundation dashboard.

## UI SDK Components Used

Seller consumes shared UI SDK primitives instead of defining local duplicated UI components:

- `Button`
- `Card`
- `Badge`
- `Container`
- `Grid`
- `PageHeader`
- `Stack`
- `DashboardLayout`

No `components/ui` library, local `Button`, local `Card`, local `Table`, or local reusable dashboard layout was added.

## Responsive Design

The foundation uses UI SDK shell primitives and Tailwind responsive layout utilities. The dashboard card grid and readiness section adapt between mobile, tablet, and desktop widths.

Target viewports:

- 390px mobile
- 768px tablet
- 1024px desktop
- 1440px wide desktop

## RTL/LTR Support

The root document starts with English `lang="en"` and `dir="ltr"`. The UI SDK shell includes runtime direction toggling, and the global CSS uses logical properties for focus and skip-link placement. Future locale work can bind direction to the active locale without restructuring the shell.

## Security Considerations

- `/dashboard/*` is protected by the Next `proxy.ts` route protection convention.
- Unauthenticated dashboard requests redirect to `/login` with a relative return path.
- Login rejects protocol-relative redirect values.
- Zitadel PKCE transaction data is stored in an HTTP-only, same-site, short-lived cookie.
- Session cookies are HTTP-only, same-site, secure in production, and path-scoped.
- Production deployments must configure `SELLER_SESSION_SECRET` or `NEXTAUTH_SECRET` so Seller session and auth transaction cookies can be HMAC-signed.
- Seller Portal does not import Core packages, access Core data, or implement backend business rules.

## Testing

Commands run from `/var/www/personal/matjero/seller`:

```sh
git fetch origin
git checkout main
git pull origin main
git checkout -b feature/ui-5-seller-portal-foundation
git merge-base HEAD origin/main
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Results:

- `git merge-base HEAD origin/main`: `e303087bbac77b2be32a646313dcd57ab5d1d367`
- `npm ci`: passed, audited 212 packages, 0 vulnerabilities.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: passed.
  - `web/seller`: 2 files, 5 tests.
  - `web/storefront`: 21 files, 212 tests.
- `npm run build`: passed.
  - `web/seller`: Next routes `/`, `/login`, `/auth/callback`, `/dashboard`, `/dashboard/[...segments]`, `/logout`.
  - `web/storefront`: existing storefront routes still build.
- `FAKE_CORE_PORT=18180 STOREFRONT_API_PORT=18181 SELLER_API_PORT=18182 SELLER_WEB_PORT=3011 NEXT_PORT=3010 MINIO_PORT=19001 npm run test:e2e`: passed, 47 tests.

`npm ci` emitted the existing allow-scripts policy warning for `esbuild@0.28.2`; the command still completed successfully.

## Files Changed

- `package.json`
- `package-lock.json`
- `scripts/run-e2e.sh`
- `playwright.config.ts`
- `web/seller/package.json`
- `web/seller/tsconfig.json`
- `web/seller/next-env.d.ts`
- `web/seller/next.config.ts`
- `web/seller/postcss.config.mjs`
- `web/seller/tailwind.config.ts`
- `web/seller/vitest.config.ts`
- `web/seller/proxy.ts`
- `web/seller/app/**`
- `web/seller/components/shell/SellerShell.tsx`
- `web/seller/config/seller-navigation.tsx`
- `web/seller/lib/auth/**`
- `web/seller/tests/**`
- `tests/e2e/seller-foundation.spec.ts`
- `tests/e2e/support/fixtures.ts`

Removed obsolete Vite SPA Seller Portal files under `web/seller/src`, plus Vite entrypoints and old SPA tests.

## Known Limitations

- Dashboard metrics are placeholder-only foundation data.
- Role, permission, and tenant filtering are extension points only.
- No Seller business workflow pages are implemented.
- No Product, Inventory, Order, Customer, Storefront, Analytics, or Settings API integration is implemented.
- No Stitch MCP design was used because no official Seller Portal Stitch designs exist.
- Production runtime configuration must provide `SELLER_SESSION_SECRET` or `NEXTAUTH_SECRET`.

## Final Verification Status

Phase UI-5 local verification is green.
