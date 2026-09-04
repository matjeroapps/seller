# P4.9 Storefront Performance, Security & Multi-Tenant Regression Report

## Metadata
- **Branch**: `feature/p4-storefront-performance`
- **Seller Base SHA**: `1354a9ab2d4e001b5ac5ac13aaac958aa69505c7`
- **Core Reference SHA**: `a466e5166e844a64215362c288f3c353f702d7a2`
- **PR**: https://github.com/matjeroapps/seller/pull/12
- **Test Suite Status**: SELLER E2E CONTRACT/TRANSPORT TEST (Playwright 36/36 PASS)

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
   - `hreflang="en"`, `hreflang="ar"`, and `hreflang="x-default"` links are strictly required.
   - Every alternate URL uses the resolved host and matches the tenant locale routing matrix.
3. **OpenGraph Metadata (`og:url`, `og:site_name`, `og:title`, etc.)**:
   - `meta[property="og:url"]` required; must equal host-resolved canonical URL.
   - `og:site_name` matches store name (`Store A` / `Store B`).
4. **Twitter Cards (`twitter:card`)**:
   - `meta[name="twitter:card"]` required (`summary_large_image`).
   - Title and description verified for tenant isolation.
5. **Product JSON-LD (`script[type="application/ld+json"]`)**:
   - Parsed JSON `@type` must be `Product`.
   - `name`, `url` (host-scoped), `offers.price`, and `offers.priceCurrency` verified.
   - Verified strict absence of `supplier_id`, `supplier_offer_id`, `wholesale_price`, `margin`, or Store B host.
6. **Preview SEO Safety**:
   - Preview pages require `robots` tag equal to `noindex, nofollow`.
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
   - **Root Cause**: `router.go` `writeStorefrontError` missed a explicit case for `coreclient.CodeUnavailable`.
   - **Files Changed**: `internal/storefrontapi/router.go` & `cmd/fake-core/main.go`.
   - **Safe Behavior**: Mapped `coreclient.CodeUnavailable` explicitly to `http.StatusServiceUnavailable` (503).

---

## 5. Security, Privacy & XSS Assertions

1. **Theme XSS Proof**:
   - Malicious theme title fixtures containing script tags (`<script>window.__MATJERO_XSS__='theme-script'</script>`) and event handlers (`<img src=x onerror="window.__MATJERO_XSS__='theme'">`) rendered through normal React theme components.
   - Execution marker `window.__MATJERO_XSS__` remained `undefined`. No inline event handlers or active attacker script elements executed in the DOM.
2. **Product Content XSS Proof**:
   - Malicious product name/description fixtures (`<svg onload="window.__MATJERO_XSS__='product-svg'">`) tested.
   - Execution marker `window.__MATJERO_XSS__` remained `undefined`.
3. **Seller Transport Privacy & Defense-in-Depth**:
   - **Core Privacy Claim (Separation)**: Core PostgreSQL & API internal privacy rules are proven separately by Core's unit/integration test suites.
   - **Seller Defense-in-Depth**: Verified via Fake Core `/test-control/extra-fields` endpoint where Fake Core injects raw upstream fields (`supplier_id`, `supplier_contact`, `supplier_offer_id`, `wholesale_price_minor`, `supplier_margin_minor`).
   - Verified that Next.js rendered HTML, RSC payloads, and storefront-api JSON responses contain **zero forbidden markers**, proving Seller's local typed DTO boundary does not proxy unknown upstream internal fields.
4. **Cross-Store IDOR**:
   - Requesting Store A host + Store B product slug returns HTTP 404 without Store B content or internal markers.
5. **Category Path Isolation**:
   - Unknown category slugs and Store B-only category slugs on Store A host return clean HTTP 404 pages.
6. **Host Normalization**:
   - Inbound hosts with upper/mixed case (`STORE-A.LOCALHOST`) or explicit ports (`store-a.localhost:3000`) resolve to normalized `store-a.localhost`.

---

## 6. Redis Cache & Revision Invalidation Proof

1. **Tenant Isolation**: Warming Store A Redis cache entries does not serve Store B.
2. **Revision Invalidation & Store B Unaffected Proof**:
   - Warm Store A and Store B caches.
   - Bump Store A revision only.
   - Request Store A: Cash invalidated, triggers fresh Core payload call.
   - Request Store B: Served directly from Redis cache; Store B payload call counter does not increment.
   - Proves tenant revision namespaces are fully isolated (`tenant:{store_id}:rev:{rev_id}`).

---

## 7. Performance Critical-Path Findings & Call Counts

Measurements taken using deterministic Fake Core endpoint call counters:

| Path | Cold Core Calls | Warm Core Calls | Cacheable? | Performance Finding |
| :--- | :---: | :---: | :---: | :--- |
| **Home (`/`)** | 1 Rev Probe + 1 Payload | 1 Rev Probe + 0 Payload | Yes | Sub-millisecond warm render; zero duplicate payload calls. |
| **Catalog (`/en/products`)** | 1 Rev Probe + 1 Payload | 1 Rev Probe + 0 Payload | Yes | Paginated product list cached per host + query parameters. |
| **Product Detail (`/en/products/[slug]`)** | 1 Rev Probe + 1 Payload | 1 Rev Probe + 0 Payload | Yes | Single payload fetch hydrates both UI components and JSON-LD script. |
| **Search (`/en/search?q=...`)** | 1 Rev Probe + 1 Payload | 1 Rev Probe + 0 Payload | Yes | Query-indexed cache prevents redundant Core search lookups. |
| **Sitemap (`/sitemap.xml`)** | 1 Rev Probe + 1 Payload | 1 Rev Probe + 0 Payload | Yes | Deterministic tenant-filtered URL listing generated from cache. |
| **Theme Bootstrap / Preview** | 1 Payload (Direct) | Uncached | No | `Cache-Control: private, no-store`, `robots: noindex, nofollow` prevents cache poisoning. |

---

## 8. Verification Matrix & CI Status

- **Playwright Test Count**: 36 / 36 PASSING
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
