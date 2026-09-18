# Phase 7 — Seller & Storefront Payment Operations Integration Report

## Executive Summary
This report documents the end-to-end implementation of **Phase 7 — Seller & Storefront Payment Operations Integration** across `matjeroapps/core` and `matjeroapps/seller`. Building on the Core Payments aggregate foundation, this phase introduces store-scoped HTTP APIs for initializing payments, querying payment details, and updating payment statuses (`CREATED`, `PENDING`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `CANCELLED`, `REFUNDED`), seller coreclient DTOs and methods, Seller Web order payment management UI (`PaymentStatusCard.tsx`), and Storefront customer order payment status tracking.

---

## 1. Core API Updates (`matjeroapps/core`)

- **Internal API Handlers**:
  - `handleGetPayment`: Added `GET /internal/v1/payments/{paymentID}` to fetch payment details and transaction attempts.
  - `handleGetPaymentByOrder`: Added `GET /internal/v1/orders/{orderID}/payments` to fetch order payment status.
- **Route Registration**: Registered GET endpoints under the internal v1 payment capabilities group in `core/internal/coreapi/router.go`.
- **OpenAPI Specification**: Regenerated `core/docs/api/internal/openapi.json`.

---

## 2. Seller Coreclient & Seller API (`matjeroapps/seller`)

- **Coreclient DTOs & Methods** (`seller/internal/coreclient/payments.go`):
  - DTOs: `InitializePaymentRequest`, `UpdatePaymentStatusRequest`, `PaymentAttemptResponse`, `PaymentResponse`.
  - Client Methods: `InitializeOrderPayment`, `GetPayment`, `GetOrderPayment`, `UpdatePaymentStatus`.
- **Store-Scoped Handlers** (`seller/internal/sellerapi/payments.go`):
  - `handleInitializePayment`: `POST /v1/seller/stores/{store_id}/orders/{order_id}/payments` (`seller_owner`, `seller_manager`)
  - `handleGetOrderPayment`: `GET /v1/seller/stores/{store_id}/orders/{order_id}/payments` (`seller_owner`, `seller_manager`, `seller_staff`)
  - `handleGetPayment`: `GET /v1/seller/stores/{store_id}/payments/{payment_id}` (`seller_owner`, `seller_manager`, `seller_staff`)
  - `handleUpdatePaymentStatus`: `POST /v1/seller/stores/{store_id}/payments/{payment_id}/status` (`seller_owner`, `seller_manager`)
- **Router & Contract Verification**:
  - Updated `CoreCapabilities` interface and registered payment routes in `seller/internal/sellerapi/router.go`.
  - Added unit/contract tests `TestStorePaymentOperations` in `seller/internal/sellerapi/router_test.go`.
  - Regenerated Seller OpenAPI spec `seller/docs/api/openapi.json`.

---

## 3. Seller Web Dashboard (`matjeroapps/seller`)

- **API Layer**:
  - `web/seller/lib/api/types.ts`: Defined `PaymentAttempt`, `Payment`, `InitializePaymentPayload`, and `UpdatePaymentStatusPayload`.
  - `web/seller/lib/api/client.ts`: Added `initializeOrderPayment`, `getOrderPayment`, `getPayment`, and `updatePaymentStatus` to `sellerApi`.
- **UI Components**:
  - `web/seller/components/shell/PaymentStatusCard.tsx`: Created card displaying payment status badges, formatted major currency amount, payment method, state transition controls (e.g. `Mark Captured` for COD / manual collection), and transaction attempt timeline.
  - `web/seller/app/(dashboard)/dashboard/stores/[store_id]/orders/[order_id]/page.tsx`: Integrated `PaymentStatusCard` into the seller order detail view.

---

## 4. Storefront Integration (`matjeroapps/seller`)

- **Customer View**:
  - Updated `web/storefront/src/app/[locale]/(store)/orders/[orderID]/page.tsx` to render a Payment Status summary section displaying Payment Method, Payment Status badge, and total amount payable.

---

## 5. Testing & Verification

- **Core Go Suite**: `gofmt -s -w .`, `go vet ./...`, `go test ./...` in `core`: PASS.
- **Seller Go Suite**: `gofmt -s -w .`, `go vet ./...`, `go test ./...` in `seller`: PASS (100% of package unit/contract tests pass).
- **Frontend Builds**: `npm run build` in `web/seller` and `web/storefront`: PASS.
- **Playwright E2E Suite**: Added `seller/tests/e2e/seller-payment-operations.spec.ts`.
