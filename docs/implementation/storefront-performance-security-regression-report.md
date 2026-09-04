# P4.9 Storefront Performance, Security & Multi-Tenant Regression Report

## Metadata
- **Branch**: `feature/p4-storefront-performance`
- **Seller Base SHA**: `1354a9ab2d4e001b5ac5ac13aaac958aa69505c7`
- **Core Reference SHA**: `a466e5166e844a64215362c288f3c353f702d7a2`

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
| ** Branded Theme** | Modern (Theme A) | Classic (Theme B) | **PASS**: Published themes isolated |
| **Exclusive Products** | `product-a` (100.00 EGP) | `product-b` (250.00 EGP) | **PASS**: No cross-store leakage |
| **Shared Product** | `shared-slug` (150.00 EGP) | `shared-slug` (180.00 EGP) | **PASS**: Host-authoritative pricing |
| **Draft Theme Preview** | `valid-preview-token-store-a` | `valid-preview-token-store-b` | **PASS**: Tokens scoped to store |

---

## 3. Security, Privacy & Performance Regression Results

### Multi-Tenant & Host Security
- **A → B → A & B → A → B Sequences**: Verified zero cross-store data leakage in single browser contexts.
- **Same-Path Tenant Isolation**: `/en/products/shared-slug` under Store A vs Store B returns host-authoritative content and pricing.
- **Parameter Confusion (`store_id`, `seller_id`)**: Public query parameters cannot override Host tenant resolution.
- **Host Spoofing**: Inbound spoofed headers (`X-Forwarded-Host`, `Forwarded`, `X-Matjero-Storefront-Host`) are ignored unless explicitly configured behind trusted proxies.
- **Host Normalization**: Lowercase normalization, port stripping, and unknown/inactive host handling verified.

### Data Privacy & Security
- **Supplier Privacy**: Internal supplier IDs (`SUPPLIER_INT_...`), wholesale costs, margins, and supplier offer IDs seeded in memory are strictly omitted from public HTML/JSON/RSC payloads.
- **Seller Price Integrity**: Customer price is strictly the Seller listing price (e.g., 100.00 EGP), never supplier cost (50.00 EGP).
- **Cross-Store IDOR**: Store A host + Store B resource slug returns 404 Store A response.
- **XSS Safety**: Malicious markup and script tags in theme configurations and product content render safely without script execution.
- **404 / Store Not Found Privacy**: Generic 404 error pages disclose no moderation details, internal store IDs, or Core stack traces.
- **Core Outage Recovery**: Simulating Core 503 returns a safe generic unavailable response without leaking service topology or tokens; service recovers cleanly when Core returns.

### SEO & Sitemap Isolation
- **Sitemap (`/sitemap.xml`)**: Store A sitemap contains only Store A URLs; Store B sitemap contains only Store B URLs.
- **SEO Metadata**: `robots.txt`, `<link rel="canonical">`, `hreflang`, OpenGraph, Twitter, and JSON-LD URLs use the resolved host.
- **Open Redirect Audit**: Verified root locale redirects and path normalization cannot be exploited for external open redirects (`Location: https://attacker.example`).

### Redis Cache Isolation & Revision Proof
- **Cache Isolation**: Warming Store A cache entry never returns cached response to Store B.
- **Revision Invalidation**: Bumping Store A revision invalidates Store A cache namespace; Store B cache is unaffected. No Redis wildcard `SCAN` or deletion required.
- **Cache Safety for Previews**: Preview requests carry `Cache-Control: private, no-store` and never poison public Redis cache.
- **Call-Count Proof**:
  - Cold Request: Triggers 1 Core revision probe call + 1 Core payload call.
  - Warm Request: Triggers 1 Core revision probe call + 0 Core payload calls (served directly from Seller Redis cache).

---

## 4. Verification Suite Status

- **Go Backend Tests**: `GOWORK=off go test -count=1 ./...` — PASS
- **Go Vet & Format**: `gofmt -l`, `go vet ./...` — PASS
- **Frontend Typecheck & Tests**: `npm run typecheck`, `npm run test` — PASS
- **OpenAPI Spec**: `go run ./cmd/openapi-gen` — Unchanged (0 drift)
- **Repository Independence**: `GOWORK=off go list -m all` — PASS (ADR-017 compliant)
- **Fresh Clone**: Independent build & test outside workspace — PASS
- **Docker Targets**: `seller-api`, `storefront-api`, `storefront web` — PASS
