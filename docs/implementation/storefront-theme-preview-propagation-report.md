# Stage B — Seller Preview Propagation + Cache Bypass Implementation Report

## Overview

This task completes Stage B of the Storefront Theme Preview system. It establishes end-to-end draft theme preview propagation across the Seller application (`storefront-web`, `storefront-api`, and `coreclient`), fully integrating with Core's Stage A preview runtime (`X-Matjero-Storefront-Preview`).

No P4.7 Theme Management UI or authorization logic was implemented, keeping the feature branch clean, isolated, and strictly focused on runtime infrastructure prerequisites.

---

## Technical Architectural Changes

### 1. Internal Core Client (`internal/coreclient`)
- Added `HeaderStorefrontPreview = "X-Matjero-Storefront-Preview"` constant to `client.go`.
- Extended `requestOptions` and `do()` to conditionally send `X-Matjero-Storefront-Preview: <previewToken>` when present.
- Added `StorefrontStorePreview(ctx context.Context, host, previewToken string, locale i18n.Locale) (StoreBootstrap, error)` method to `storefront.go`.

### 2. Storefront API & Cache Bypass (`internal/storefrontapi`)
- Updated `CatalogReader` interface in `router.go` to include `StorefrontStorePreview(...)`.
- Added preview token validation (max 4096 bytes).
- Implemented complete Redis cache bypass in `handleStore`: when `X-Matjero-Storefront-Preview` header is received, the handler bypasses `Revisions.StorefrontRevision` probing, bypasses `Cache.Lookup` and `Cache.Save`, invokes `StorefrontStorePreview(...)`, and sets `Cache-Control: private, no-store` and `Pragma: no-cache`.
- Updated error mapping in `writeStorefrontError`:
  - `CodePreviewUnavailable` -> HTTP `503 Service Unavailable` with `{"error": "preview_unavailable"}`.
  - `CodeSchemaMismatch` and `CodeUnsafeContent` -> HTTP `400 Bad Request` with `{"error": "validation_error"}`.

### 3. OpenAPI Documentation (`internal/openapi` & `docs/api/storefront/openapi.json`)
- Added optional `X-Matjero-Storefront-Preview` header parameter specification to `/v1/storefront/store` route.
- Regenerated `docs/api/storefront/openapi.json` using `cmd/openapi-gen`.

### 4. Next.js Storefront Web (`web/storefront`)
- **Proxy / Middleware (`src/proxy.ts`)**:
  - Strips all incoming `x-matjero-*` headers to prevent header injection.
  - Extracts `theme_preview` query parameter from request URLs.
  - Validates token size (<=4096 bytes) and rejects duplicate `theme_preview` query params fail-closed (`x-matjero-preview-invalid`).
  - Sets internal header `x-matjero-preview-token`.
  - Sets response headers on outgoing preview responses: `Cache-Control: private, no-store`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`.
- **API Client (`src/lib/api.ts`)**:
  - Updated `StorefrontClient.store(host, locale, previewToken?)` to accept optional preview token and pass `X-Matjero-Storefront-Preview` header to `storefront-api`.
- **Request Context & Store Loading (`src/server/store-context.ts` & `src/server/presentation.ts`)**:
  - Read preview headers per request via React `cache`.
  - Keyed `loadStore` on `(host, locale, previewToken)` to guarantee request memoization without cache contamination across requests or preview states.
  - Failed closed when preview store resolution fails (throwing `StoreUnavailableError` without falling back to published storefront content).
- **Link Navigation (`src/lib/preview.ts` & `src/lib/view-models.ts`)**:
  - Implemented centralized `previewAwareHref(href, previewToken)` helper.
  - Automatically appends/preserves `theme_preview=<token>` across all internal navigation (home, products, categories, search, pagination, category cards, product cards, breadcrumbs, locale links).
  - Strictly excludes external links (`http://`, `https://`, `//`, `mailto:`, `tel:`, `javascript:`) to prevent capability token leakage.
- **SEO & Security (`src/server/seo.ts`)**:
  - Sets `robots: { index: false, follow: false }` (`noindex, nofollow`) whenever preview mode is active.
  - Preserves clean canonical URLs, language alternate URLs, and Open Graph URLs without `theme_preview` parameters.
  - Omits Product JSON-LD structured data during preview mode.

---

## Verification Results

| Suite / Test | Status | Result Summary |
| :--- | :--- | :--- |
| **Go Unit Tests** (`GOWORK=off go test -count=1 ./...`) | PASS | 100% pass across all packages (`internal/coreclient`, `internal/storefrontapi`, `internal/openapi`, etc.) |
| **Frontend Unit Tests** (`npm run test`) | PASS | 16 test files passed, 184 tests passed |
| **TypeScript Check** (`npm run typecheck`) | PASS | 0 type errors |
| **ESLint Check** (`npm run lint`) | PASS | 0 lint warnings/errors |
| **Next.js Production Build** (`npm run build`) | PASS | App compiled cleanly with Next.js Turbopack |
| **Docker Build Check** | PASS | `docker/go-app.Dockerfile` built cleanly |

---

## PR Readiness Summary

- **Branch Name**: `feature/storefront-theme-preview-propagation`
- **Base Branch**: `main` (`c7798b6ca0782a7d5eac367037a695bf8569483c`)
- **Status**: Complete, verified, and ready for review/PR creation.
