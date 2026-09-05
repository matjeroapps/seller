# MatjerHub Phase 5.8 — Seller Catalog Operations Report

## Metadata
- **Base SHA**: `6f244c1c5f428b39f573dc775da357700213e602`
- **Branch**: `feature/p5-8-seller-catalog-operations`
- **Reviewed Head SHA**: `2b1c93768f8a6421f1c700af7a21db9ee71e68b8`
- **Core Dependency**: `feature/p5-8-seller-catalog-operations` (Core PR #34)
- **PR Status**: Ready for review (Not merged)

## Key Capabilities Implemented
1. **Core Client Extension (`internal/coreclient`)**: Extended authenticated HTTP client with 24 methods covering Seller products, variants, SKUs, presigned S3 media, locations, inventory snapshots, presentation, publish/unpublish, and order lifecycle transitions.
2. **Seller API (`internal/sellerapi`)**: Exposed authenticated endpoints under `/seller/stores/{store_id}/...`, enforcing strict server-side subject identity authorization.
3. **Storefront API & Buy Now Orchestration (`internal/storefrontapi`)**: Implemented `POST /v1/storefront/buy-now` creating dedicated Cart B, adding SKU, creating Checkout Session, setting HttpOnly `matjero_buy_now_session_<sessionID>` cookie marker, and updating checkout finalize to preserve normal `matjero_cart`.
4. **Seller Dashboard UI (`web/seller`)**:
   - Added `/products` tab with Authoring Wizard (General with EN/AR/RTL fields, Variants/SKUs, S3 media upload flow, Pricing & Inventory, Product Page section editor, and Publish checklist).
   - Added `/orders` tab and Order Detail view with status filter and operational action buttons (`Confirm Order`, `Start Processing`, `Mark Ready for Shipping`, `Cancel Order`).
5. **Storefront UI (`web/storefront`)**: Rendered structured sections below hero on ProductDetail page and updated `PurchaseControl` to orchestrate Buy Now and redirect to checkout.

## ADR-017 Compliance & Repository Independence
- Zero Core Go package imports.
- Zero direct Core PostgreSQL database connections.
- Clean API/HTTP boundary between Seller web/API and Core.

## Automated Verification
- `GOWORK=off go build ./...` passed cleanly for `seller-api` and `storefront-api`.
- `GOWORK=off go test ./...` passed cleanly across all Go packages.
- `npm run typecheck --workspace=@commerce/seller-web` passed cleanly with 0 errors.
- `npm run test` passed 100% cleanly across all frontend component & page test suites (190/190 unit tests passed).
- `npm audit --audit-level=high` returned 0 vulnerabilities.
- OpenAPI specification regenerated via `GOWORK=off go run ./cmd/openapi-gen`.
