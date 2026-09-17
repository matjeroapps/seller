# Seller Catalog Operations — Seller API Boundary Implementation Report

**Status:** Complete & Verified

**Date:** 2026-09-17

**Repository:** `matjeroapps/seller`

## Summary

Implemented the Seller API boundary HTTP surface and transport DTOs for store-scoped seller catalog operations in `matjeroapps/seller`. This work exposes store-level seller catalog endpoints under `/v1/seller/stores/{store_id}/...`, enforces role-based access control matrix checks (`seller_owner`, `seller_manager`, `seller_staff`), handles operation-specific idempotency and error translation, deprecates legacy query/body-scoped routes, and regenerates the Seller OpenAPI specification.

## Architecture Changes

1. **Store-Scoped HTTP Surface (`/v1/seller/stores/{store_id}/...`)**:
   - Exposed explicit store-scoped routes for store status transitions, supplier offer browsing and import, store listings, listing readiness, publish/unpublish/archive, product status transitions, product archival, store media asset library, and product media references.
   - Preserved core client delegation pattern (`ADR-017`): Seller API handles authentication, transport validation, role check, and DTO mapping, while Core internal API enforces decisive business rules.

2. **Role Authorization Matrix Enforcement**:
   - Enforced role capability checks using `auth.PrincipalFrom(r.Context())`:
     - Store creation & status transition: `seller_owner` only.
     - Product/listing authoring, offer import, publish/unpublish/archive, media upload/completion/deletion, media reference attach/update/detach: `seller_owner`, `seller_manager`.
     - Read operations (stores, catalog, offers, listings, readiness, media library, references, inventory, orders) and inventory adjustments: `seller_owner`, `seller_manager`, `seller_staff`.
   - Access attempts lacking required roles return uniform `403 forbidden` (`httpx.WriteError(w, http.StatusForbidden, "forbidden", ...)`).

3. **Core Error Vocabulary Mapping**:
   - Expanded `coreclient/errors.go` and `actorhttp.WriteCoreError` with new Core domain error codes (`store_entitlement_exceeded`, `upload_in_progress`, `checksum_mismatch`, `media_in_use`, `publish_not_ready`, `offer_unavailable`, `resource_in_use`, `idempotency_conflict`).
   - Mapped domain errors to clean public status codes (`409 Conflict`, `422 Unprocessable Entity`) without leaking internal transport details or stack traces.

4. **Legacy Route Deprecation**:
   - Marked query/body-scoped legacy routes (`GET /v1/seller/catalog/offers`, `POST /v1/seller/listings/import`, `POST /v1/seller/listings/{id}/price`, `POST /v1/seller/listings/{id}/status`) as deprecated while maintaining backwards-compatible delegation to store-scoped client operations.

## Repository Impact

- `matjeroapps/seller`: All changes are localized within `seller` (`internal/coreclient`, `internal/actorhttp`, `internal/sellerapi`, `docs/api/openapi.json`, `docs/implementation`). No external repos were modified.

## Database Changes

- None in `seller` repository (Seller API owns no direct database access; Core owns PostgreSQL persistence).

## API Changes

- Seller OpenAPI specification (`docs/api/openapi.json`) was regenerated via `go run ./cmd/openapi-gen`.

Exposed & Verified Routes:
- `POST /v1/seller/stores/{store_id}/status`
- `GET /v1/seller/stores/{store_id}/supplier-offers`
- `POST /v1/seller/stores/{store_id}/supplier-offers/{offer_id}/imports`
- `GET /v1/seller/stores/{store_id}/listings`
- `GET /v1/seller/stores/{store_id}/listings/{listing_id}`
- `PUT /v1/seller/stores/{store_id}/listings/{listing_id}/price`
- `GET /v1/seller/stores/{store_id}/listings/{listing_id}/readiness`
- `POST /v1/seller/stores/{store_id}/listings/{listing_id}/publish`
- `POST /v1/seller/stores/{store_id}/listings/{listing_id}/unpublish`
- `POST /v1/seller/stores/{store_id}/listings/{listing_id}/archive`
- `POST /v1/seller/stores/{store_id}/products/{product_id}/status`
- `POST /v1/seller/stores/{store_id}/products/{product_id}/archive`
- `GET /v1/seller/stores/{store_id}/media`
- `POST /v1/seller/stores/{store_id}/media/uploads`
- `POST /v1/seller/stores/{store_id}/media/uploads/{intent_id}/complete`
- `DELETE /v1/seller/stores/{store_id}/media/{asset_id}`
- `GET /v1/seller/stores/{store_id}/products/{product_id}/media-references`
- `POST /v1/seller/stores/{store_id}/products/{product_id}/media-references`
- `PUT /v1/seller/stores/{store_id}/products/{product_id}/media-references/{reference_id}`
- `DELETE /v1/seller/stores/{store_id}/products/{product_id}/media-references/{reference_id}`

## Security Considerations

- Public identity headers (`X-Matjero-*`) are stripped at boundary; subject is extracted strictly from the authenticated JWT principal.
- Store ownership is verified by Core on every request; cross-tenant path attempts yield uniform `404 Not Found`.
- End-user tokens carry seller membership roles; endpoints enforce role checks prior to invoking Core.
- MinIO object keys, storage credentials, and internal completion digests are never exposed to Seller public API clients.

## Testing and Exact Validation Results

### Commands Executed

```bash
gofmt -s -w .
go vet ./...
go test -v ./...
go run ./cmd/openapi-gen
```

### Validation Results

1. **`gofmt -s -w .`**: Clean, 0 formatting diffs.
2. **`go vet ./...`**: Clean, 0 warnings/errors.
3. **`go test -v ./...`**: Full local test suite passed cleanly across all packages (`cmd/fake-core`, `internal/actorapi`, `internal/auth`, `internal/config`, `internal/coreclient`, `internal/httpx`, `internal/i18n`, `internal/money`, `internal/openapi`, `internal/redisx`, `internal/sellerapi`, `internal/storefrontapi`, `internal/storefrontcache`).
4. **OpenAPI Generator**: Verified and updated `docs/api/openapi.json`.

## Files Changed

- `internal/coreclient/errors.go`: Added error codes for entitlement, upload progress, checksum mismatch, media in use, publish readiness, offer availability, resource in use; updated status mapping.
- `internal/coreclient/sellers.go`: Updated `ListSellerStores` DTO with entitlement metadata; added `UpdateStoreStatus`, `ListStoreSupplierOffers`, `ImportSupplierOffer`, `GetStoreListing`, `SetStoreListingPrice`, `GetStoreListingReadiness`, `PublishStoreListing`, `UnpublishStoreListing`, `ArchiveStoreListing`.
- `internal/coreclient/catalog_orders.go`: Added product status/archive methods (`TransitionProductStatus`, `ArchiveProduct`), store media library methods (`ListStoreMedia`, `PresignStoreMediaUpload`, `CompleteStoreMediaUploadIntent`, `DeleteStoreMediaAsset`), and product media reference methods (`ListProductMediaReferences`, `AttachProductMediaReference`, `UpdateProductMediaReference`, `DetachProductMediaReference`).
- `internal/actorhttp/actorhttp.go`: Mapped new Core error codes to public HTTP status codes and error JSON payloads.
- `internal/sellerapi/router.go`: Expanded `CoreCapabilities` interface; registered new store-scoped routes.
- `internal/sellerapi/catalog_orders.go`: Added role enforcement helper `requireRoles` and handlers for store status, supplier offers, listings, readiness, publish/unpublish/archive, media library, and media references.
- `internal/sellerapi/router_test.go`: Updated `stubCore` mock implementation; added `TestStoreScopedCatalogAndRoleAuthorization` test suite.
- `docs/api/openapi.json`: Regenerated OpenAPI specification.
- `docs/implementation/seller-catalog-api-boundary-report.md`: Created implementation report.

## Known Limitations

- Real Core integration and MinIO upload flows are tested end-to-end in containerized `platform-infra`; unit/router tests stub Core internal HTTP responses.

## Final Verification Status

**APPROVED** — Code, OpenAPI spec, tests, role authorization, error handling, and documentation are complete and verified. Phase-name leakage audit passed cleanly.
