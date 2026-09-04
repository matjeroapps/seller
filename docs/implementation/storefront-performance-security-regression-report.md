# P4.9 Storefront Performance, Security & Multi-Tenant Regression Report

## Metadata
- **Branch**: `feature/p4-storefront-performance`
- **Seller Base SHA**: `1354a9ab2d4e001b5ac5ac13aaac958aa69505c7`
- **Core Reference SHA**: `a466e5166e844a64215362c288f3c353f702d7a2`
- **PR**: https://github.com/matjeroapps/seller/pull/12
- **Test Suite Status**: SELLER E2E CONTRACT/TRANSPORT TEST (Playwright 41/41 PASS)

---

## 1. P4.9 Architecture Reconciliation & ADR-017 Compliance

In accordance with ADR-017 (Repository Independence):
- **Seller owns no database**: Business correctness against PostgreSQL is tested and maintained strictly within the Core repository.
- **Deterministic Fake Core HTTP Stub (`cmd/fake-core`)**: A lightweight, zero-dependency Go HTTP server process simulates Core's internal contract (`/internal/v1/storefront/...`) for `storefront-api`.
- **E2E Pipeline**:
  - `Playwright Chromium` → `Next.js Storefront Web` (standalone server) → `storefront-api` (Go process) → `fake-core` (HTTP stub) + `Redis` (Seller cache service).
- **Zero Cross-Repo Compile Dependencies**: No Core source code, no `go.work`, no `replace` directives, no direct database connections.

---

## 2. Store A / Store B Fixture Matrix & Test Results

| Invariant / Feature | Store A (`store-a.localhost`) | Store B (`store-b.localhost`) | Verification Result |
| :--- | :--- | :--- | :--- |
| **Store Identity** | `store-a` / Store A | `store-b` / Store B | **PASS**: 100% Tenant Isolation |
| **Locale & Direction** | `en` (LTR) | `ar` (RTL) | **PASS**: LTR / RTL isolated |
| **Branded Theme** | Modern (Theme A) | Classic (Theme B) | **PASS**: Published themes isolated |
| **Exclusive Products** | `product-a` (100.00 EGP) | `product-b` (250.00 EGP) | **PASS**: No cross-store leakage |
| **Shared Product** | `shared-slug` (150.00 EGP) | `shared-slug` (180.00 EGP) | **PASS**: Host-authoritative pricing |
| **Draft Theme Preview** | `valid-preview-token-store-a` | `valid-preview-token-store-b` | **PASS**: Tokens scoped to store |

---

## 3. SEO Metadata Invariants & Assertion Proofs

Playwright suite (`tests/e2e/storefront-seo.spec.ts`) strictly enforces non-conditional, mandatory existence for all SEO tags:

1. **Canonical URLs (`link[rel="canonical"]`)**:
   - Exactly one `link[rel="canonical"]` required per page.
   - Must use resolved tenant host (`store-a.localhost`), never Store B host, with valid locale/path.
2. **Language Alternates (`hreflang`)**:
   - Mandatory `hreflang="en"`, `hreflang="ar"`, and `hreflang="x-default"` links verified for both Store A and Store B.
   - Every alternate URL strictly uses the target store's host and matches the tenant locale routing matrix (`store-a.localhost/en`, `store-a.localhost/ar`, `store-b.localhost/ar`, `store-b.localhost/en`).
3. **OpenGraph Metadata (`og:url`, `og:site_name`, `og:title`)**:
   - `meta[property="og:url"]` required; must equal host-resolved canonical URL.
   - `og:site_name` matches store name (`Store A` / `Store B`).
4. **Twitter Cards & Description (`twitter:card`, `twitter:title`, `twitter:description`)**:
   - Mandatory `meta[name="twitter:card"]` (`summary_large_image`), `twitter:title`, and `twitter:description`.
   - Title and description verified for tenant isolation.
5. **Product JSON-LD (`script[type="application/ld+json"]`)**:
   - Parsed JSON `@type` must be `Product`.
   - `name`, `url` (host-scoped), `offers.price`, and `offers.priceCurrency` verified.
   - Verified strict absence of `supplier_id`, `supplier_offer_id`, `wholesale_price`, `margin`, or Store B host.
6. **Preview SEO Safety**:
   - Preview pages require `robots` tag containing both `noindex` and `nofollow` (`content="noindex, nofollow"`).
   - Product JSON-LD is intentionally suppressed on preview pages.

---

## 4. Production Code Fixes & Rationale

During P4.9 hardening, Playwright tests identified three production metadata/routing edge cases:

1. **Narrowed Metadata Error Policy (`web/storefront/src/server/presentation.ts`)**:
   - **Bug Discovered**: Initial P4.9 work wrapped `generateMetadata` in blanket `try { ... } catch { return {} }` blocks. This caused SEO tags to silently vanish on unexpected 500/503 errors.
   - **Root Cause**: Over-broad exception handling masked API outages and programming errors.
   - **Files Changed**: `web/storefront/src/server/presentation.ts` and all route `page.tsx` files (`page.tsx`, `categories/[slug]/page.tsx`, `products/page.tsx`, `products/[slug]/page.tsx`, `search/page.tsx`).
   - **Safe Behavior**: Introduced `isExpectedMetadataError()` helper that catches **only** expected typed Storefront API errors (`not_found`, `invalid_request`, `store_unresolved`) and returns `{}` for Next.js to trigger safe 404 rendering. All other unexpected errors (500/503) are thrown so Next.js error boundaries handle them.

2. **JSON-LD Script Tag HTML Escaping (`web/storefront/src/app/[locale]/(store)/products/[slug]/page.tsx`)**:
   - **Bug Discovered**: Product descriptions containing HTML or script-like text truncated the JSON-LD `<script>` element in browser HTML parsing.
   - **Root Cause**: Unescaped `<` characters in `JSON.stringify(jsonLd)` caused premature browser script tag termination.
   - **Files Changed**: `web/storefront/src/app/[locale]/(store)/products/[slug]/page.tsx`.
   - **Safe Behavior**: Replaced `<` with `\u003c` in serialized JSON-LD (`JSON.stringify(jsonLd).replace(/</g, '\\u003c')`), ensuring valid script tag parsing.

3. **Core Outage Service Unavailable Mapping (`internal/storefrontapi/router.go`)**:
   - **Bug Discovered**: Core unavailability returned HTTP 500 Internal Server Error instead of the mandated HTTP 503.
   - **Root Cause**: `router.go` `writeStorefrontError` missed an explicit case for `coreclient.CodeUnavailable`.
   - **Files Changed**: `internal/storefrontapi/router.go` & `cmd/fake-core/main.go`.
   - **Safe Behavior**: Mapped `coreclient.CodeUnavailable` explicitly to `http.StatusServiceUnavailable` (503).

---

## 5. Security, Privacy & Extra-Field Emissions Proof

1. **Extra-Fields Privacy Proof (Uncached Revision + Emissions Counter)**:
   - **False-Positive Elimination**: `setExtraFieldsMode(true)` assigns Store A a unique revision (`getUniqueTestRevision()`), ensuring an uncached lookup in Redis.
   - **Emissions Counter Proof**: Fake Core tracks raw extra-field payload emissions via `GET /test-control/extra-field-emissions`. Asserting `emissionsAfter > emissionsBefore` strictly proves that `storefront-api` issued a live call to Fake Core and received the forbidden fields (`supplier_id`, `supplier_contact`, `supplier_offer_id`, `wholesale_price_minor`, `supplier_margin_minor`).
   - **Sanitization & Safe Cache**: `storefront-api` stripped the raw extra fields from public JSON, cached the sanitized DTO in Redis, and Next.js rendered safe product HTML containing zero forbidden fields or internal markers.
2. **Core Privacy Claim (Separation)**:
   - Core PostgreSQL & API internal privacy rules are proven separately by Core's unit/integration test suites.
   - Seller proves defense-in-depth transport privacy at its public DTO boundary.
3. **Theme & Product XSS Safety**:
   - Malicious theme title fixtures (`<script>window.__MATJERO_XSS__='theme-script'</script>`) and product content (`<svg onload="...">`) rendered through normal React components. Execution marker `window.__MATJERO_XSS__` remained `undefined` with zero script execution.
4. **Cross-Store IDOR & Category Isolation**:
   - Store A host + Store B product slug or rival category slug strictly returns HTTP 404 with zero Store B data leakage.
5. **Host Normalization**:
   - Inbound upper/mixed case hosts (`STORE-A.LOCALHOST`) and explicit ports (`store-a.localhost:3000`) resolve to normalized `store-a.localhost`.

---

## 6. Redis Cache & Revision Invalidation Proof

1. **Tenant Isolation**: Warming Store A Redis cache entries does not serve Store B.
2. **Revision Invalidation & Store B Unaffected Proof**:
   - Warm Store A and Store B caches.
   - Bump Store A revision only.
   - Request Store A: Cache invalidated, triggers fresh Core payload call.
   - Request Store B: Served directly from Redis cache; Store B payload call counter does not increment.
   - Proves tenant revision namespaces are fully isolated (`tenant:{store_id}:rev:{rev_id}`).

---

## 7. Measured Page-Level Performance & Core Call Counts

Measurements captured using deterministic Fake Core call counters (`GET /test-control/calls`) with counter resets (`POST /test-control/calls/reset`) on dedicated test revisions:

| Path | Cold Revision Probes | Cold Payload Calls | Warm Revision Probes | Warm Payload Calls | Endpoint Count Breakdown | Caching Finding |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Home (`/en`)** | 3 | 3 | 3 | 0 | `/store`: 1, `/categories`: 1, `/products`: 1 | Warm Redis eliminates Core payload calls; 3 revision probes check cache freshness. |
| **Catalog (`/en/products`)** | 3 | 3 | 3 | 0 | `/store`: 1, `/categories`: 1, `/products`: 1 | Page bootstrap and catalog list cached in Redis. |
| **Product Detail (`/en/products/product-a`)** | 4 | 4 | 4 | 0 | `/store`: 1, `/categories`: 1, `/products/product-a`: 2 | Independent `generateMetadata` + page fetches cached in Redis. |
| **Search (`/en/search?q=Product`)** | 3 | 3 | 3 | 0 | `/store`: 1, `/categories`: 1, `/search`: 1 | Bootstrap & search result query cached in Redis. |
| **Sitemap (`/sitemap.xml`)** | 5 | 5 | 5 | 0 | `/store`: 1, `/categories`: 2, `/products`: 2 | Sitemap iterates supported locales (en, ar); payloads cached in Redis. |
| **Theme Preview** | N/A | 1 (Direct) | N/A | Uncached | `/store`: 1 | `Cache-Control: private, no-store`, `robots: noindex, nofollow` prevents cache poisoning. |

### Architectural Performance Interpretation
- **Warm Redis Caching**: Eliminates Core **PAYLOAD** reads (`warmPayloadCalls == 0`).
- **Core Revision Probes**: Intentionally remain on warm requests (`warmRevisionProbes == coldRevisionProbes`). Per P4.4 architecture, every `storefront-api` resource request executes `deps.serve()`, which probes Core's `/internal/v1/storefront/revision` before checking Redis. This guarantees a disabled store, inactive domain, or superseded revision is immediately recognized without serving stale cached content.

---

## 8. Verification Matrix & CI Status

- **Playwright Test Count**: 41 / 41 PASSING
- **Go Backend Tests**: `GOWORK=off go test -count=1 ./...` — PASS
- **Go Vet & Format**: `gofmt -l`, `go vet ./...` — PASS
- **Frontend Typecheck & Tests**: `npm run typecheck`, `npm run test` — PASS (190 unit tests passing)
- **OpenAPI Spec**: `go run ./cmd/openapi-gen` — 0 drift
- **Repository Independence**: `GOWORK=off go list -m all` — PASS (ADR-017 compliant)
- **CI Artifact Uploads**: Playwright `playwright-report/` and `test-results/` configured with `if: failure() || always()` in `.github/workflows/ci.yml`.

---

## 9. Integration Status & Known Limitations

### Runtime Integration Smoke Status
`RUNTIME INTEGRATION SMOKE NOT EXECUTED`

*Note: The Playwright test suite executed here is a **SELLER E2E CONTRACT/TRANSPORT TEST** using `cmd/fake-core` stubbing, strictly adhering to ADR-017 repository independence. Live end-to-end integration against PostgreSQL and a live Core service binary is performed separately in full system integration environments.*

### Known Limitations
1. **Host Spoofing**: Inbound host resolution relies on upstream reverse proxy (e.g. Cloudflare / Nginx) stripping or overwriting `X-Forwarded-Host` headers before reaching Seller.
2. **Single Chromium Worker**: E2E tests run with a single Playwright worker (`workers: 1`) to preserve deterministic Redis cache state and call count tracking.
