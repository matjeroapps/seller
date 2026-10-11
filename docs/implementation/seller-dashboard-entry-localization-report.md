# Seller Dashboard Entry, Currency, and Arabic Localization — Seller Implementation Report

Feature: `specs/033-seller-dashboard-entry-localization/` (tasks T003–T013, T015–T016, T018–T019,
T021–T025, T027–T028, T031–T032; validation evidence for T035).

## Summary

This report covers the Seller repository changes for feature 033. Seller owns the dashboard entry
decision, the canonical selected-store shell/navigation/theme, the finance BFF error propagation and
currency display, the Arabic localization and English fallback behavior, and the removal of
additional-store creation from the UI while first-store onboarding remains functional. The Core
counterpart (first-store invariant and authoritative finance currency) is documented in
`core/docs/implementation/seller-dashboard-entry-localization-report.md`.

## Changes

### One-enterable-workspace direct entry (US1, T003–T007)

`seller/web/seller/components/dashboard/DashboardOverview.tsx`:

- Resolves `/dashboard` from the authenticated Merchant bootstrap with
  `Promise.allSettled([sellerApi.getStores(), fetchMerchantConsole()])`.
- Counts only **enterable** workspaces: `isOperableWorkspace` requires
  `merchant_status === 'active' && membership.status === 'active'`
  (`seller/web/seller/lib/api/merchant-console.ts`), so suspended merchants and
  `invited`/`suspended` memberships are excluded.
- Exactly one enterable workspace with exactly one active authorized store
  (`activeAuthorizedStores()` keeps only `status === 'active'`; drafts/inactive never qualify)
  redirects directly to
  `/dashboard/merchants/{merchant_id}/stores/{store_id}`.
- One enterable workspace with zero or multiple active stores, or more than one enterable workspace,
  shows explicit workspace/store selection. Zero enterable workspaces routes to
  `/dashboard/onboarding`; a workspace with zero stores shows the first-store onboarding entry.
- `resolvedRef` guarantees the entry decision runs once, so a stale bootstrap response cannot
  re-trigger a redirect.

### Canonical navigation and theme (US2, T008–T013)

- `seller/web/seller/components/shell/SellerShell.tsx` derives the selected workspace/store,
  sidebar items, breadcrumbs, and active item from the URL
  (`/dashboard/merchants/{merchantId}(/stores/{storeId})?`). Bootstrap fetches are `AbortController`-
  guarded and re-read the current URL before applying a response, preventing stale workspace
  restaging. Workspace-only navigation is retained when no store is selected.
- `seller/web/seller/config/seller-navigation.tsx`: `getNavigationForMerchantWorkspace` emits
  store-scoped items (`catalog`, `orders`, `storefront`, `finance`, `integrations`) only with a
  `storeId`; supply children stay at workspace scope; settings/account fall back to the workspace
  prefix. Visibility still requires an `active` capability and the relevant permission.
- `seller/web/seller/components/shell/StoreSwitcher.tsx`: the visual fallback that presented the
  first workspace store as selected before its route was chosen was removed; a stale/unauthorized
  routed store shows the explicit unselected state.
- `seller/web/seller/tailwind.config.ts` sets `darkMode: ['selector', '[data-theme="dark"]']` and
  `seller/web/seller/app/styles/globals.css` keeps `:root[data-theme='dark']` as the only dark
  palette. `SellerShell` writes `data-theme` on `<html>`, so the OS `prefers-color-scheme` no longer
  affects Seller surfaces.

### Finance BFF error propagation and authoritative currencies (US3, T015–T016, T018–T019)

- `seller/internal/coreclient/finance.go`: `GetStoreBalance` returns `(nil, err)` on Core failure
  instead of synthesizing a zero/`SAR` value; `ListStorePayouts` propagates as well.
- `seller/internal/sellerapi/finance.go`: all four handlers use the established Core error writer
  `actorhttp.WriteCoreError`; the balance handler writes the balance JSON only on success.
  `seller/internal/actorhttp/actorhttp.go` maps Core `store_entitlement_exceeded` to HTTP `409` with
  the same code, and Core unavailability/deadline to HTTP `503` `service_unavailable`.
- `seller/web/seller/lib/dashboard-model.ts`: `formatMinorMoney` returns `'Unavailable'` when the
  amount is non-finite or the currency is blank (no `SAR` default). The store page
  (`app/(dashboard)/dashboard/stores/[store_id]/page.tsx`) and finance page
  (`app/(dashboard)/dashboard/stores/[store_id]/finance/page.tsx`) use per-record currency
  (`entry.currency`, `s.currency`, `p.currency`) and render an explicit unavailable/error state when
  the balance is unresolved.

### Complete dashboard localization and fallback (US4, T021–T025, T037)

- `seller/web/seller/lib/i18n/locale-context.tsx`: locale persists in the `mh_locale` cookie
  (`path=/`, `max-age=365d`, `SameSite=Lax`); `applyLocaleToDom` sets `documentElement.lang` and
  `dir` (`rtl` for `ar`). `t()` resolves the active dictionary, then the English dictionary, then
  `fallback ?? key`, so an untranslated fixed string renders its English text rather than a key,
  blank, or placeholder. `serverMessage` prefers `message_ar`/`message_en` and preserves available
  text. Theme state is owned separately by `SellerShell`, so locale changes never change theme.
- `seller/web/seller/locales/en.json` and `seller/web/seller/locales/ar.json` carry matching keys for
  the shell, sidebar, breadcrumbs, controls, workspace/store menus, merchant/Supply routes, store
  operational routes, forms, and empty/loading/error states.
- `seller/scripts/check-seller-dashboard-locales.mjs` (new, untracked) is the dictionary coverage
  scanner.

### Store creation unavailable (US5, T027–T028, T031–T032)

- `seller/web/seller/components/shell/StoreSwitcher.tsx`: the Create Store CTA, form state, and
  additional-store mutation were removed; the only API call is `sellerApi.getStores()`. Store
  listing and authorized selection remain (`handleSelectStore` navigates to the workspace-scoped
  store route).
- `seller/web/seller/components/onboarding/StoreOnboardingWizard.tsx` and
  `seller/web/seller/app/(dashboard)/dashboard/onboarding/page.tsx`: first-store onboarding still
  works for a merchant with no store record and routes to the created store. A rejected
  additional-store attempt (`ApiError.code === 'store_entitlement_exceeded'`) renders the actionable
  `onboarding.additionalStoreRejected` message (EN/AR) instead of an `alert()`.

### Repository files changed (Seller working tree, uncommitted)

- Go: `seller/internal/coreclient/client_test.go`, `seller/internal/coreclient/finance.go`,
  `seller/internal/sellerapi/finance.go`, `seller/internal/sellerapi/router_test.go`
- Script (new): `seller/scripts/check-seller-dashboard-locales.mjs`
- Web shell/config/theme: `seller/web/seller/components/shell/SellerShell.tsx`,
  `.../shell/StoreSwitcher.tsx`, `.../shell/MerchantWorkspaceSwitcher.tsx`,
  `.../shell/MerchantAccessDenied.tsx`, `seller/web/seller/config/seller-navigation.tsx`,
  `seller/web/seller/tailwind.config.ts`, `seller/web/seller/app/styles/globals.css`
- Web dashboard/onboarding/seller components: `seller/web/seller/components/dashboard/DashboardOverview.tsx`,
  `.../components/onboarding/StoreOnboardingWizard.tsx`, `.../components/seller/*`,
  `.../components/supply/supply-state.tsx`
- Web routes: `seller/web/seller/app/(dashboard)/dashboard/merchants/[merchant_id]/**` (Supply tree),
  `.../stores/[store_id]/**` (analytics, billing, carts, catalog, customers, error, finance,
  integrations, inventory, media, notifications, orders, storefront, shipments), and the store
  overview page
- Web data/locale: `seller/web/seller/lib/dashboard-model.ts`,
  `seller/web/seller/lib/i18n/locale-context.tsx`, `seller/web/seller/locales/en.json`,
  `seller/web/seller/locales/ar.json`
- Web tests: `seller/web/seller/tests/dashboard-model.test.ts`,
  `.../tests/dashboard-overview-null-safety.test.tsx`, `.../tests/i18n-localization.test.tsx`,
  `.../tests/merchant-console-navigation.test.tsx`, `.../tests/merchant-console.test.tsx`,
  `.../tests/sds-1-data-truth.test.tsx`, `.../tests/theme-switch.test.tsx`,
  `.../tests/unsupported-capability-routes.test.tsx`

## API impact

- **Additional-store rejection (Core → Seller).** Core maps `ErrMerchantStoreAlreadyExists` to HTTP
  `409` with code `store_entitlement_exceeded`; the Seller API preserves that status/code via
  `actorhttp.WriteCoreError`, and the onboarding wizard keys its actionable message off the same
  code. Direct API attempts are rejected by Core, not only by the UI.
- **Balance error propagation.** A Core balance error no longer becomes a `200` zero/`SAR` payload.
  The Seller BFF surfaces Core failures (unavailable/deadline → `503 service_unavailable`; other Core
  errors keep their mapped status), and the UI shows an unavailable/error state.
- **Currency.** Balance, ledger, settlement, and payout records carry their own `currency`; the
  balance response documents `available_minor`, `pending_minor`, `currency`, `updated_at`
  (`core/docs/api/internal/openapi.json` regenerated on the Core side). The Seller OpenAPI money
  schema already required `currency`, so no Seller spec change was needed.
- **No new Seller endpoints.** Existing routes and the `mh_locale` cookie/`lang`/`dir` conventions
  are preserved.

## Validation

All commands below were executed in this workspace. Results are reported verbatim.

### Seller Go suite

```bash
cd seller && go test ./...
```

Result: **all packages `ok` or `[no test files]`; exit 0.** Includes
`seller/internal/coreclient`, `seller/internal/sellerapi`, `seller/internal/openapi`.

### Seller web full suite

```bash
cd seller/web/seller && npm test
```

Result: **`Test Files 38 passed (38)`, `Tests 239 passed (239)`; exit 0.** This supersedes the
earlier 38 files / 230 tests baseline: the final localization additions raised the total to 239.

### Focused dashboard test command (quickstart)

```bash
cd seller/web/seller && npm test -- tests/merchant-console.test.tsx tests/merchant-console-navigation.test.tsx tests/dashboard-overview-null-safety.test.tsx tests/dashboard-model.test.ts tests/i18n-localization.test.tsx tests/sds-1-data-truth.test.tsx
```

Result: **`Test Files 6 passed (6)`, `Tests 79 passed (79)`; exit 0.**

### Focused localization tests

```bash
cd seller/web/seller && npx vitest run tests/i18n-localization.test.tsx
```

Result: **`Test Files 1 passed (1)`, `Tests 30 passed (30)`; exit 0.**

### Locale scanner

```bash
cd seller && node scripts/check-seller-dashboard-locales.mjs
```

Result (exit 0):

```
Seller dashboard locale coverage OK: 999 EN keys, 999 AR keys, 892 used dashboard keys,
no untranslated copy in the gated route roots (dashboard overview, merchant/Supply tree,
store integrations/media pages, the store orders/shipments/storefront route trees, the
store-root overview page and its error boundary, the store inventory route tree, and the
store catalog categories/listings route trees, and the store catalog products and
supplier-offers route trees).
```

Independent key count confirms `en.json` 999 flattened keys, `ar.json` 999 flattened keys, 0 English
keys missing from Arabic.

### Typecheck

```bash
cd seller/web/seller && npm run typecheck
```

Result: `next typegen && tsc --noEmit` completed with no TypeScript errors; exit 0.

### Checks not run (Seller)

- Browser/container acceptance (`cd platform-infra && make test-seller-live`) — **attempted;
  blocked by a missing-browser environment**. The exact command
  `cd platform-infra && make test-seller-live` was executed. Playwright started 6 tests, and all 6
  failed before test execution because Chromium was missing at
  `/home/ahmed/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`;
  Playwright suggested `npx playwright install`. No test body or assertion ran, so no browser
  acceptance is claimed.
- `cd seller/web/seller && npm run build` — **PASSED.** Next.js 16.3.8 production build compiled, typechecked, generated static pages, and finalized the route bundle successfully.
- `npm run lint` was not executed separately; in this package it is the same command as typecheck
  (`next typegen && tsc --noEmit`), which passed.

## Known Limitations

- **No browser acceptance evidence (environment blocker, not an assertion failure).** The browser
  acceptance command did run after this report was drafted: `cd platform-infra && make test-seller-live`
  was executed, Playwright started 6 tests, and all 6 failed before test execution because Chromium
  was missing at
  `/home/ahmed/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`
  (Playwright suggested `npx playwright install`). Because no test body executed, the SC-mapped
  runtime cases in `specs/033-seller-dashboard-entry-localization/quickstart.md` (SC-001–SC-008: SSO
  direct entry, store/workspace switching, OS-vs-Seller theme, live Arabic navigation, live
  create-rejection, `make test-seller-live`) remain unconfirmed. Only unit/type/scan evidence is
  claimed; do not treat this report as browser acceptance.
- `npm run build` passed: the Next.js 16.3.8 production build compiled, typechecked, generated static pages, and finalized the route bundle successfully, so a production build is verified in this session.
- `seller/internal/coreclient/finance.go` `ListStoreLedgerEntries` and `ListStoreSettlements` still
  convert Core errors into empty slices; only `GetStoreBalance` and `ListStorePayouts` propagate
  errors. This is an observed asymmetry, not covered by the balance-focused change.
- `seller/web/seller/components/shell/StoreSwitcher.tsx` retains a legacy auto-redirect to
  `/dashboard/stores/{id}` when no store is selected on a non-workspace path; this is separate from
  the removed create CTA and first-store fallback.
- Locale coverage is "no untranslated copy in the gated route roots" (892 used dashboard keys of 999
  EN/AR keys). Routes outside that root list are not gated by the scanner.
- `specs/033-seller-dashboard-entry-localization/tasks.md` checkboxes T033, T034, and T036 are checked;
  T035 is now eligible to be checked because all applicable unit/integration suites, Seller Web
  typecheck/build, locale scanner, and the browser command were executed, with browser acceptance
  blocked before assertions by the missing Chromium executable and that blocker documented here.
- Changes are uncommitted in the Seller working tree on branch
  `codex/category-picker-valid-list-markup`; no commit or PR was created.
