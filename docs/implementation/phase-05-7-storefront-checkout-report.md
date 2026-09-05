# Phase 5.7 Implementation Report — Storefront Cart, Checkout & Secure Guest Orders (Seller)

**Base SHA**: `d75f84c66cfca9ab4c79c8a3495c5080be28a7af`  
**Previous Head SHA**: `46fa08e13a3895ee947000b0e95c91c5aaae9832`  
**Corrective Head SHA**: `f0dde27ef64820d79bfd6b5908723452fd07b315`  
**Branch**: `feature/p5-7-storefront-checkout`  
**Repository**: `matjeroapps/seller`  
**PR**: #13  

---

## 1. Overview & Architecture

Phase 5.7 implements the customer-facing Storefront Cart, Checkout Session, and Guest Order Access APIs along with Next.js web storefront purchase controls, Cart, Checkout, and Order confirmation UI.

All operations follow **ADR-017**:
- Zero cross-repository Go imports.
- Seller reaches Core strictly via `internal/coreclient` over authenticated HTTP.
- Tenant identity derived exclusively from the trusted request `Host` header.
- Zero raw capability tokens exposed to browser JavaScript, DOM, URLs, or local storage.

---

## 2. Public API Surface (`storefront-api`)

Added under public `/v1/storefront`:

```http
POST   /v1/storefront/carts
GET    /v1/storefront/carts
POST   /v1/storefront/carts/items
PATCH  /v1/storefront/carts/items/{itemID}
DELETE /v1/storefront/carts/items/{itemID}

POST   /v1/storefront/checkout/sessions
POST   /v1/storefront/checkout/sessions/{sessionID}/finalize

GET    /v1/storefront/orders/{orderID}
POST   /v1/storefront/orders/{orderID}/cancel
```

### Feature Gate
- Controlled by `STOREFRONT_CHECKOUT_ENABLED` (`false` by default).
- When disabled, transactional endpoints return `404 Not Found`.

---

## 3. Capability Cookie Security Model

1. **Cart Cookie**: `matjero_cart`
   - `HttpOnly`, `Path=/`, `SameSite=Lax`, host-bound.
   - Holds raw cart capability token returned from Core on cart creation.
   - Token is stripped from JSON body before responding to browser.

2. **Pre-issued Checkout Session Cookie**: `matjero_guest_session_<checkoutSessionID>`
   - `HttpOnly`, `Path=/`, `SameSite=Lax`, host-bound.
   - Holds pre-issued guest capability token returned from Core session creation.
   - Stripped from session response JSON.
   - Required by Seller at checkout finalization boundary.

3. **Finalization Capability Promotion**:
   - Upon successful finalization in Core, Seller promotes the session capability token into an order-specific cookie: `matjero_guest_order_<orderID>`.
   - Session cookie is expired (`Max-Age=-1`) in the same response.
   - Capability promotion is idempotent on response-loss retry.
   - Multiple guest orders remain independently accessible (Order A cookie does not overwrite Order B cookie).

---

## 4. Public Contract Sanitation & Authority Defense

- **Authority Defense**: Browser JSON requests decode with `DisallowUnknownFields()`. Submitting `seller_listing_id`, `supplier_id`, `supplier_offer_id`, `fulfillment_location_id`, or `price` yields `400 invalid_argument`.
- **Public Response Sanitation**: Public Order response DTO (`OrderResponse`) includes buyer-safe address fields (`recipient_name`, `address_line_1`, `address_line_2`, `city`, `region`, `postal_code`, `country_code`, `phone`) while stripping internal fields: `store_id`, `customer_id`, `checkout_session_id`, `seller_listing_id`, `supplier_id`, `fulfillment_location_id`, `reservation_id`, guest capabilities, and digests.

---

## 5. Web Storefront UI & Next.js Integration

- **Product Detail (`PurchaseControl.tsx`)**: Variant/SKU selector, quantity input, Add-to-Cart action posting `sku_id` + `quantity`, out-of-stock disablement.
- **Cart Page (`/[locale]/cart/page.tsx`)**: Line item listing, quantity update, item removal, cart subtotal, continue shopping, checkout CTA.
- **Checkout Page (`/[locale]/checkout/[sessionID]/page.tsx`)**: Recipient name, street address, city, region, postal code, country code, email contact form.
- **Order Page (`/[locale]/orders/[orderID]/page.tsx`)**: Order details, status badge, buyer-safe Shipping Address card, items summary, totals, confirmation deadline, pending order cancellation button.
- **Localization**: Full English and Arabic support with RTL layout support.

---

## 6. Target Corrective Patch Details

### Blocker 1: Go Formatting
- Applied `gofmt -w` to all Go sources in `cmd/`, `internal/`, `apps/`.
- Verified `gofmt -l` returns zero unformatted files.

### Blocker 2: Storefront Tenant Host Propagation Through Next.js
- **Root Cause**: Next.js server proxies/rewrites browser requests to `storefront-api` (changing Host header to `127.0.0.1:8080`).
- **Solution**: Next.js `proxy.ts` strips untrusted client `x-matjero-*` headers and passes original request host via `x-matjero-storefront-host` header to `storefront-api`.
- **Security Guarantee**: `storefront-api` reads `X-Matjero-Storefront-Host` only when `TRUSTED_FORWARDED_HOST=true` is enabled for internal proxy deployment. External browser-supplied `X-Forwarded-Host` or `X-Matjero-Storefront-Host` headers are stripped by `proxy.ts` and rejected.

### Blocker 3: Real Product -> Cart -> Checkout E2E
- Fixed E2E submit button selector target to click `.checkout-form button[type="submit"]` rather than header search form submit button.
- All 45 Playwright E2E tests pass 100% green without retries.

### Blocker 4: Fake Core Multi-Order Identity & Replay Invariant
- Refactored `cmd/fake-core` to generate atomic unique Cart IDs, Session IDs, and Order IDs per flow (`cart-1`, `session-1`, `order-1`).
- Implemented `finalizedSessions` state tracking: retrying `POST /checkout/sessions/{sessionID}/finalize` with the same `sessionID` returns the exact same `OrderID` without creating duplicate orders or rotating access capabilities.

### Blocker 5: Buyer-Safe Shipping Address on Order Page
- Added `OrderAddressResponse` DTO to `internal/storefrontapi/contracts.go` and mapped `address` field in `ToOrderResponse`.
- Updated Next.js Order Detail page (`web/storefront/src/app/[locale]/(store)/orders/[orderID]/page.tsx`) and locale dictionaries (`en` / `ar`) to render the Shipping Address card.

---

## 7. Verification Evidence

### Backend & Frontend Tests
- `gofmt -l`: 0 unformatted files.
- `GOWORK=off go test ./...`: 100% green across all packages.
- `npm run lint` & `npm run typecheck`: 0 errors.
- `npm run test`: 17 test files, 190 tests passed (100% green).
- Playwright E2E (`./scripts/run-e2e.sh`): 45 tests passed (100% green).
- Public OpenAPI spec regenerated via `GOWORK=off go run ./cmd/openapi-gen`.
- Zero raw capability leaks in public body, URL, or local storage.

### Scope Discipline Checklist
- P5.8 Seller Order Management started: NO
- Product authoring started: NO
- Media upload system started: NO
- Landing Page builder started: NO
- Buy Now separate pipeline started: NO
- Shipping started: NO
- Payment started: NO
- Customer IAM started: NO
