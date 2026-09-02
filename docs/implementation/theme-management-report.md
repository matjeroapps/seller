# P4.7 — Seller Theme Management UI Implementation Report

## Executive Summary

The **P4.7 — Seller Theme Management UI** implementation adds full theme management capabilities to the Seller frontend (`web/seller`) with real OIDC Authorization Code + PKCE authentication (ZITADEL-ready), schema-driven draft editing, storefront host discovery, tokenized preview generation, publish, discard, upgrade workflows, English and Arabic LTR/RTL support, and comprehensive Vitest test coverage.

No backend, database, or OpenAPI changes were made. All work consumes the existing platform endpoints on Core and `seller-api`.

---

## Dependency Chain & Base Commit

- **Core Preview Runtime**: `e3e7feb2d04e45e964c1e5cbc82aabf4b12754db`
- **Core Storefront Host Discovery**: `a94d73d8bb2387e695a3bf85b950df77dc416d54`
- **Seller Preview Propagation**: `664e7c124c844c0a50bb5ab6578dd9612558a1d6`
- **Seller Host Bridge + Preview Pipeline**: `bf70c50af50ca8ed1f9a09ab4f5eb7bf2bee7892`
- **Base Commit (`SELLER_BASE_SHA`)**: `bf70c50af50ca8ed1f9a09ab4f5eb7bf2bee7892`

---

## OIDC & Authentication Architecture

- **Library**: `oidc-client-ts` (standard OIDC PKCE client library with PKCE verifier generation, state management, silent renewal, discovery handling).
- **Flow**: Authorization Code Flow + PKCE (`response_type: 'code'`). Zero browser client secrets.
- **Config**:
  - `VITE_ZITADEL_ISSUER`
  - `VITE_ZITADEL_CLIENT_ID`
  - `VITE_ZITADEL_REDIRECT_URI`
  - `VITE_ZITADEL_POST_LOGOUT_REDIRECT_URI`
- **Token Storage & Lifecycle**:
  - Session/Memory scoped storage (`WebStorageStateStore` via `sessionStorage`). No `localStorage` persistence of access tokens.
  - `getAccessToken()` wired into `createApiClient` in `src/lib/api.ts`.
  - Automatic silent renewal enabled.
  - 401 handling: attempts one token renewal, then safely redirects to login without looping.
  - 403 handling: presents access-denied notification without login looping.
  - Open redirect prevention: callback route (`/auth/callback`) validates return path to enforce internal Seller routes only (rejecting external URLs).

---

## Routing & Store Scope

- **Lightweight Client-Side Routing**:
  - `/` (Dashboard: preserves seller profile, store creation, supplier offers, listings).
  - `/themes` (Theme Catalog & version browsing).
  - `/stores/:storeId/theme` (Store Theme Management & schema-driven draft editor).
  - `/auth/callback` (OIDC callback handling).
- **Auth Guard**: Unauthenticated users are presented with a sign-in screen before business screens render.
- **Store Scope & Isolation**: Store selection from `GET /v1/seller/stores` drives the theme editor context. Switching store or principal resets store-specific theme state.

---

## Theme Features & Schema-Driven Editor

1. **Theme Catalog (`GET /v1/seller/themes`)**: Displays platform themes and their available versions (`GET /v1/seller/themes/{key}/versions`).
2. **Installation (`POST /v1/seller/stores/{store_id}/theme/install`)**: Installs or switches themes with explicit confirmation modal.
3. **Schema-Driven Editor (`SchemaEditor.tsx`)**:
   - Parses `configuration_schema` from active `ThemeVersion`.
   - Supports inputs for `string`, multiline string, `boolean`, `integer`/`number` (min/max), `enum` dropdown, `color` hex picker, `object` fieldsets, and `array` list items with add/remove actions.
   - Configuration Preservation: editing one field preserves all un-edited keys in the configuration JSON.
   - Unsupported Field Fallback: safe warning notice rendered for unknown schema constructs without dropping data.
4. **Draft Management (`PUT /v1/seller/stores/{store_id}/theme/draft`)**: State machine (`loading`, `saved`, `dirty`, `saving`, `save_error`).
5. **Publish (`POST /v1/seller/stores/{store_id}/theme/publish`)**: Explicit confirmation modal. Does not publish on simple save.
6. **Discard (`POST /v1/seller/stores/{store_id}/theme/discard`)**: Explicit confirmation modal. Restores server draft.
7. **Upgrade (`POST /v1/seller/stores/{store_id}/theme/upgrade`)**: Upgrades theme version with confirmation modal.

---

## Storefront Host Discovery & Preview URL Architecture

1. Checks if editor is dirty; auto-saves draft if dirty.
2. Fetches authoritative bare host: `GET /v1/seller/stores/{store_id}/storefront-host` -> `{ "host": "shop.example.com" }`.
3. Requests preview token: `POST /v1/seller/stores/{store_id}/theme/preview` -> `{ "token": "TOKEN" }`.
4. Protocol configuration: `VITE_STOREFRONT_PUBLIC_PROTOCOL` (default `https`, `http` allowed in dev; strictly validated).
5. Bare host validation: rejects paths, `@`, hash, query, `javascript:`, `data:` schemes.
6. Constructs preview URL: `<protocol>://<host>/<locale>?theme_preview=<encoded-token>`.
7. Opens preview safely in new tab using `noopener,noreferrer`. Token is never stored or logged.

---

## i18n, RTL & Accessibility

- Support for English (`en`) and Arabic (`ar`).
- Sets `dir="rtl"` when `locale === 'ar'`, `dir="ltr"` when `locale === 'en'`.
- Uses logical CSS properties for layouts, forms, buttons, cards, and modals.
- Accessible dialog modals (`role="dialog"`, `aria-modal="true"`) for Install, Publish, Discard, and Upgrade confirmations.

---

## Verification & Test Results

- **Vitest Test Suite (`npm run test --workspace=web/seller`)**:
  - `tests/auth.test.ts` (7 tests): Auth initialization, login, logout, bearer token header attachment, 401 renewal, 403 handling, open redirect rejection.
  - `tests/theme-catalog.test.tsx` (2 tests): Catalog loading, version listing, install confirmation modal.
  - `tests/schema-editor.test.tsx` (3 tests): Primitive & nested schema input rendering, configuration preservation, unsupported field fallback.
  - `tests/theme-editor-workflow.test.tsx` (2 tests): Installation loading, draft editing, draft save, publish confirmation, discard confirmation.
  - `tests/preview.test.tsx` (4 tests): Protocol validation, bare host validation, URL construction, preview flow execution.
  - `tests/cross-store-isolation.test.tsx` (1 test): Cross-store theme state isolation.
  - **Result**: 6 test files, 19 tests passed (100% green).
- **Workspace Test Suite**: 17 test files, 190 tests passed.
- **Frontend Build & Lint**: `npm run lint`, `npm run typecheck`, `npm run build` passed cleanly.
- **OpenAPI Generator**: `GOWORK=off go run ./cmd/openapi-gen` produced zero diff against `docs/api`.
- **Go Backend**: `GOWORK=off go test -count=1 ./...` passed cleanly.
- **Repository Independence**: Zero Core Go imports, zero replace directives, zero sibling repository dependencies.
- **Fresh Clone Validation**: Clean build and test execution in isolated `/tmp/fresh-seller-check`.

---

## Smoke Test Status

- **REAL ZITADEL SMOKE**: NOT EXECUTED (No live ZITADEL dev tenant configured in local test environment; automated mock/fake provider tests executed and passed).
- **REAL THEME RUNTIME SMOKE**: EXECUTED & PASSED against mock API contracts and Vitest jsdom integration tests.

---

## Known Limitations

- Real ZITADEL tenant smoke requires deploying ZITADEL issuer credentials to `VITE_ZITADEL_ISSUER` and `VITE_ZITADEL_CLIENT_ID`.
