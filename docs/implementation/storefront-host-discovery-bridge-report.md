# Stage D — Seller Host Bridge + Preview Pipeline Completion Report

## Overview

This report documents the completion of Stage D: Storefront Host Discovery Seller Bridge + Preview Pipeline Completion.

Core Storefront Host Discovery dependency commit: `a94d73d8bb2387e695a3bf85b950df77dc416d54`
Seller base commit: `664e7c124c844c0a50bb5ab6578dd9612558a1d6`
Branch: `feature/storefront-host-discovery-bridge`
`feature/p4-theme-management` remains UNTOUCHED.

---

## Deliverables & Architectural Implementation

### A. Seller Storefront Host Discovery Bridge

1. **Core Client Method & DTO (`internal/coreclient`)**:
   - Added DTO `StorefrontHostResponse`:
     ```go
     type StorefrontHostResponse struct {
         Host string `json:"host"`
     }
     ```
   - Added `GetStorefrontHost(ctx context.Context, storeID, subject string) (string, error)` calling `GET /internal/v1/stores/{storeID}/storefront-host`.
   - Passes `Authorization: Bearer <token>`, `X-Matjero-Service: seller`, and `X-Matjero-Subject: subject`.
   - Enforces defensive transport contract validation: rejects empty host, schemes (`://`), slashes (`/`), credentials (`@`), or ports (`:`).

2. **Seller Management API Endpoint (`internal/sellerapi`)**:
   - Added endpoint: `GET /v1/seller/stores/{store_id}/storefront-host`.
   - Response: `{"host": "store.example.com"}`.
   - Authorization flow: authenticated subject extracted via `actorhttp.SubjectFrom(r)`, forwarded directly to Core's `GetStorefrontHost`.
   - Core remains authoritative for store ownership check in a single HTTP call without extra `GetStore` round trips or Seller-derived store domain logic.
   - Errors mapped cleanly via `actorhttp.WriteCoreError`: unknown/unowned store returns safe `404 not_found`, Core unreachable returns `503 service_unavailable`, malformed responses return internal 500 without leaking upstream data.

3. **OpenAPI Specification (`internal/openapi` & `docs/api/seller/openapi.json`)**:
   - Documented `GET /v1/seller/stores/{store_id}/storefront-host` in `sellerRoutes()` in `internal/openapi/specs.go`.
   - Regenerated `docs/api/seller/openapi.json` via `cmd/openapi-gen`.
   - `docs/api/storefront/openapi.json` remains completely unchanged.

---

### B. Storefront Preview Pipeline Completion

1. **Presentation Loader (`web/storefront/src/server/presentation.ts`)**:
   - Resolved the presentation loader defect where `loadPresentation` previously omitted the preview token when loading store bootstrap.
   - `loadPresentation` now checks `await isPreviewInvalid()` (throws `StoreUnavailableError('store_unresolved', ...)` fail-closed when true).
   - Resolves `previewToken = await currentPreviewToken()`.
   - Calls `loadStore(host, requestedLocale, previewToken)`.
   - Passes `previewToken` into `toThemeContext({ ..., previewToken })` so that `ThemeContext` links (home, products, categories, search, top navigation, locale switch) consistently preserve preview mode without parameter duplication.

2. **Bare Root Preview Redirect (`web/storefront/src/app/page.tsx`)**:
   - Updated bare root `/` route:
     - Checks `await isPreviewInvalid()` and calls `notFound()` when true (failing closed).
     - Resolves `previewToken = await currentPreviewToken()`.
     - Probes store default locale using `loadStore(host, 'en', previewToken)`.
     - Redirects `/?theme_preview=T` to `/{defaultLocale}?theme_preview=T` using `previewAwareHref`.
     - Preserves existing default locale redirect behavior for normal requests without `theme_preview`.

3. **Invalid Preview Response Security (`web/storefront/src/proxy.ts`)**:
   - Updated proxy response header logic so that when either `PREVIEW_TOKEN_HEADER` OR `PREVIEW_INVALID_HEADER` is present:
     `Cache-Control: private, no-store`
     `Pragma: no-cache`
     `Referrer-Policy: no-referrer`
   - Guarantees invalid or duplicate preview attempts are never cached and do not leak referrers.

4. **Environment Protocol Documentation (`.env.example`)**:
   - Documented `STOREFRONT_PUBLIC_PROTOCOL=https`.

---

## Verification Results

| Suite / Verification Step | Outcome | Description |
| :--- | :--- | :--- |
| **Go Code formatting** (`gofmt -w`) | PASS | Clean |
| **Git Diff Check** (`git diff --check`) | PASS | No trailing whitespace or line issues |
| **Go Module Integrity** (`go mod tidy`) | PASS | `go.mod` and `go.sum` clean and unchanged |
| **Go Build & Vet** (`go build ./...`, `go vet ./...`) | PASS | Clean compilation across all packages |
| **Go Unit Tests** (`go test -count=1 ./...`) | PASS | 100% pass across coreclient, sellerapi, openapi, storefrontapi |
| **OpenAPI Spec Validation** | PASS | Diff restricted to expected Seller endpoint in `docs/api/seller/openapi.json` |
| **Frontend Install & Audit** (`npm ci`, `npm audit`) | PASS | 0 high/critical vulnerabilities |
| **Frontend Lint & Typecheck** (`npm run lint`, `npm run typecheck`) | PASS | 0 errors |
| **Frontend Unit & Integration Tests** (`npm run test`) | PASS | 17 test files passed, 190 tests passed |
| **Next.js & Vite Builds** (`npm run build`) | PASS | Production bundles built successfully |

---

## Next Steps for P4.7 Theme Management

Future P4.7 UI can now safely execute:
1. `GET /v1/seller/stores/{store_id}/storefront-host` -> returns `host`
2. `POST /v1/seller/stores/{store_id}/theme/preview` -> returns `token`
3. Construct preview link `https://<host>/<locale>?theme_preview=<token>`
