# Seller Catalog UI & Storefront Consolidation Report

## Summary
Delivered complete store-scoped catalog operations UI in the Seller Web Portal (`web/seller`). Integrated the store switcher with live entitlement data (`active_store_limit`, `active_store_count`), enabled source-aware catalog operations (`seller_owned` and `supplier_backed`), provided store media library management (presigned S3 upload, SHA-256 deduplication, safe delete), retail merchandising, publish readiness inspection, and lifecycle actions (publish, unpublish, archive). Consolidated customer preview/storefront links to the canonical storefront and deleted the deprecated embedded mock storefront.

## Architecture Changes
- **Store Scope in Routes:** Transformed unscoped Seller portal catalog paths to store-scoped routes (`/dashboard/stores/{store_id}/...`).
- **Store Switcher Component:** Header dropdown displaying owned stores, market codes, status badges, entitlement summary, and store creation capability.
- **Typed API Client:** Client module in `web/seller/lib/api` invoking Seller API boundary endpoints with clean error handling and credentials propagation.
- **Storefront Host Navigation:** Preview links direct to the canonical storefront host resolved by Core.
- **Mock Storefront Removal:** Removed `web/seller/app/store/[slug]`, `components/storefront`, and `lib/storefront/mock-data.ts`.

## Repository Impact
- `matjeroapps/seller`
  - `web/seller/lib/api/types.ts`: TypeScript contracts for Store, Product, SellerListing, SupplierCatalogItem, Readiness, Media, and Inventory DTOs.
  - `web/seller/lib/api/client.ts`: Typed API client for `/v1/seller/stores/{store_id}/...`.
  - `web/seller/components/shell/StoreSwitcher.tsx`: Store selection dropdown component.
  - `web/seller/components/shell/SellerShell.tsx`: Header integration of `StoreSwitcher` and dynamic navigation.
  - `web/seller/config/seller-navigation.tsx`: Navigation config with store-scoped path generation.
  - `web/seller/app/(dashboard)/dashboard/stores/[store_id]/...`:
    - `page.tsx`: Store dashboard overview.
    - `catalog/products/page.tsx`: Source-aware products list.
    - `catalog/products/new/page.tsx`: Create seller product form.
    - `catalog/products/[product_id]/page.tsx`: Product authoring & media references.
    - `catalog/supplier-offers/page.tsx`: Supplier offers discovery & import.
    - `catalog/listings/page.tsx`: Store listings overview.
    - `catalog/listings/[listing_id]/page.tsx`: Listing merchandising, readiness inspection, publish/unpublish/archive actions.
    - `inventory/page.tsx`: Store inventory snapshots & stock adjustments.
    - `media/page.tsx`: Store Media Library UI (presigned S3 upload, deduplication, safe delete).
    - `storefront/page.tsx`: Canonical storefront host settings.

## Database Changes
None (database tables and migrations are owned by Core).

## API Changes
Consumed Seller API `/v1/seller/stores/{store_id}/...` endpoints:
- `GET /v1/seller/stores`
- `POST /v1/seller/stores`
- `POST /v1/seller/stores/{store_id}/status`
- `GET /v1/seller/stores/{store_id}/products`
- `POST /v1/seller/stores/{store_id}/products`
- `POST /v1/seller/stores/{store_id}/products/{product_id}/status`
- `POST /v1/seller/stores/{store_id}/products/{product_id}/archive`
- `GET /v1/seller/stores/{store_id}/supplier-offers`
- `POST /v1/seller/stores/{store_id}/supplier-offers/{offer_id}/imports`
- `GET /v1/seller/stores/{store_id}/listings`
- `GET /v1/seller/stores/{store_id}/listings/{listing_id}`
- `PUT /v1/seller/stores/{store_id}/listings/{listing_id}/price`
- `GET /v1/seller/stores/{store_id}/listings/{listing_id}/readiness`
- `POST /v1/seller/stores/{store_id}/listings/{listing_id}/publish`
- `POST /v1/seller/stores/{store_id}/listings/{listing_id}/unpublish`
- `POST /v1/seller/stores/{store_id}/listings/{listing_id}/archive`
- `GET /v1/seller/stores/{store_id}/media`
- `POST /v1/seller/stores/{store_id}/media/uploads`
- `POST /v1/seller/stores/{store_id}/media/uploads/{intent_id}/complete`
- `DELETE /v1/seller/stores/{store_id}/media/{asset_id}`
- `POST /v1/seller/stores/{store_id}/products/{product_id}/media-references`
- `DELETE /v1/seller/stores/{store_id}/products/{product_id}/media-references/{reference_id}`
- `GET /v1/seller/stores/{store_id}/inventory`
- `POST /v1/seller/stores/{store_id}/inventory/adjustments`

## Security Considerations
- All operations are explicitly store-scoped; route parameters are validated by Core.
- Authorization relies on authenticated session cookies forwarded to Seller API and Core.
- Presigned S3 uploads compute SHA-256 client digests and verify object completion via Core.
- User interface actions visually reflect role capabilities while backend APIs enforce full authorization.

## Testing and Exact Commands/Results

1. **Frontend Workspace Linting:**
   `npm run lint` -> PASS

2. **TypeScript Compilation:**
   `npm run typecheck` -> PASS

3. **Frontend Unit Tests:**
   `npm run test` -> PASS (7 seller-web unit tests passed, 212 storefront-web unit tests passed)

4. **Frontend Production Build:**
   `npm run build` -> PASS (Optimized production build generated for both `@commerce/seller-web` and `@commerce/storefront-web`)

5. **Backend Go Verification:**
   `gofmt -s -w .` -> PASS
   `GOWORK=off go vet ./...` -> PASS
   `GOWORK=off go test ./...` -> PASS (100% pass across all Go packages)

6. **Phase-Name Leakage Audit:**
   `grep -ri "phase" web/seller` -> Audited, zero phase-name leakage in code/comments/routes/tests.

## Files Changed

- `docs/implementation/seller-catalog-ui-consolidation-report.md` [NEW]
- `web/seller/lib/api/types.ts` [NEW]
- `web/seller/lib/api/client.ts` [NEW]
- `web/seller/components/shell/StoreSwitcher.tsx` [NEW]
- `web/seller/components/shell/SellerShell.tsx` [MODIFY]
- `web/seller/config/seller-navigation.tsx` [MODIFY]
- `web/seller/app/(dashboard)/dashboard/stores/[store_id]/page.tsx` [NEW]
- `web/seller/app/(dashboard)/dashboard/stores/[store_id]/catalog/products/page.tsx` [NEW]
- `web/seller/app/(dashboard)/dashboard/stores/[store_id]/catalog/products/new/page.tsx` [NEW]
- `web/seller/app/(dashboard)/dashboard/stores/[store_id]/catalog/products/[product_id]/page.tsx` [NEW]
- `web/seller/app/(dashboard)/dashboard/stores/[store_id]/catalog/supplier-offers/page.tsx` [NEW]
- `web/seller/app/(dashboard)/dashboard/stores/[store_id]/catalog/listings/page.tsx` [NEW]
- `web/seller/app/(dashboard)/dashboard/stores/[store_id]/catalog/listings/[listing_id]/page.tsx` [NEW]
- `web/seller/app/(dashboard)/dashboard/stores/[store_id]/inventory/page.tsx` [NEW]
- `web/seller/app/(dashboard)/dashboard/stores/[store_id]/media/page.tsx` [NEW]
- `web/seller/app/(dashboard)/dashboard/stores/[store_id]/storefront/page.tsx` [NEW]
- `web/seller/tests/navigation.test.tsx` [MODIFY]
- `web/seller/tests/storefront.test.tsx` [DELETE]
- `web/seller/app/store/[slug]` [DELETE]
- `web/seller/components/storefront` [DELETE]
- `web/seller/lib/storefront/mock-data.ts` [DELETE]

## Known Limitations
None.

## Final Verification Status
APPROVED & COMPLETE
