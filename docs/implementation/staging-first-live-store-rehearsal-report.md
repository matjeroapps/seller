# MatjerHub Staging First Live Store Rehearsal Report

**Date**: 2026-09-06  
**Environment**: Production-like Staging (`APP_ENV=production`)  
**Status**: **GO** for First Controlled Live Seller Onboarding  

---

## 1. Hard Merge Gate Verification

| Repository | PR Number | Reviewed Head SHA | Merge SHA | Current Main SHA | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `matjeroapps/core` | `#35` | `4e8259c88499ff7e250a8fc889e534671b2e432e` | `1982c0f1c1ed5e66cb543e2b7b8da2f3ae4e656e` | `1982c0f1c1ed5e66cb543e2b7b8da2f3ae4e656e` | **MERGED** |
| `matjeroapps/seller` | `#15` | `c0aad77b63e2df967fe3a6fecc7a6845bea6b488` | `6637920cca540b46628195b2c8b031825100cb3c` | `6637920cca540b46628195b2c8b031825100cb3c` | **MERGED** |

---

## 2. Staging Topology & Environment

```
[ Reverse Proxy / TLS ] -> [ Seller Web / Storefront Web (Next.js) ]
                                |                        |
                                v                        v
                        [ Seller API ]            [ Storefront API ]
                                \                        /
                                 v                      v
                             [ Core Internal API (ADR-017) ]
                                /           |           \
                               v            v            v
                    [ PostgreSQL 17 ]  [ RabbitMQ 4 ]  [ MinIO S3 Storage ]
```

- **Core API**: Port `:8080`, Health `/readyz`, `APP_ENV=production`
- **Seller API**: Port `:8082`, Health `/readyz`, `APP_ENV=production`
- **Storefront API**: Port `:8083`, Health `/readyz`, `APP_ENV=production`
- **General Worker**: Background event claim & RabbitMQ outbox publisher
- **PostgreSQL**: `postgres:17-alpine` on port 5432, database `commerce_staging`
- **RabbitMQ**: `rabbitmq:4-management-alpine` on port 5672
- **MinIO Object Storage**: Port 19000, bucket `matjero-staging-media`
- **Zitadel OIDC Issuer**: `core-zitadel-3` on port 8081

---

## 3. Production Configuration Fail-Fast Validation Proof

Services were explicitly launched with `APP_ENV=production` and missing critical environment variables to verify fail-fast startup behavior:

1. **Missing `DATABASE_URL`**: `core-api` refused startup with `invalid configuration: production DATABASE_URL must be explicitly configured`.
2. **Missing `RABBITMQ_URL`**: `core-api` refused startup with `invalid configuration: production RABBITMQ_URL must be explicitly configured`.
3. **Missing `CORE_INTERNAL_SELLER_TOKEN`**: `core-api` refused startup with `invalid configuration: production CORE_INTERNAL_SELLER_TOKEN is required`.
4. **Missing `MEDIA_S3_BUCKET`**: `core-api` refused startup with `invalid configuration: production MEDIA_S3_BUCKET is required`.
5. **Default `CORE_API_BASE_URL`**: `seller-api` refused startup with `invalid configuration: production CORE_API_BASE_URL must be explicitly configured`.

---

## 4. Rehearsal Execution Summary

### A. Database & Storage Setup
- Fresh PostgreSQL database `commerce_staging` created.
- Applied all 16 schema migrations (`000001_event_delivery_foundation.up.sql` to `000016_catalog_invariants.up.sql`).
- Created baseline PostgreSQL dump: `/tmp/matjero_staging_backups/pre-rehearsal-baseline.dump` (153 KB).
- Provisioned MinIO bucket `matjero-staging-media` with presigned URL upload and CORS permissions.

### B. Seller & Store Provisioning
- **Seller ID**: `f6e3c9fd-7c6a-4e22-b40b-6986a59366e1` ("Staging Seller LLC")
- **Store ID**: `79226607-2708-4da6-a704-45799932389e` ("Matjer Staging Store")
- **Store Code**: `stg-mystore-efbd3cdc`
- **Domain**: `stg-mystore-efbd3cdc.matjero.internal` (Market: `EG`, Currency: `EGP`)
- **Fulfillment Location**: Store-owned location `Cairo Central Warehouse` (`supplier_id` = `NULL`, status = `active`).

### C. Product Authoring & Media Upload
- **Product ID**: `b73e733a-7bde-428f-a8ac-65a6402ee927`
- **SKU**: `JKT-LTHR-BLK-M-b73e` (Variant: `Size M / Black`)
- **EN Name**: "Matjer Premium Leather Jacket"
- **AR Name**: "جاكيت جلدي فاخر متجر"
- **Price**: `2499.00 EGP` (`249900` minor units)
- **Inventory**: `10` units available at store-owned location.
- **S3 Media**: 3 real images uploaded via direct browser HTTP PUT presigned flow. Non-first image #2 set as primary image with alt text.
- **Presentation**: All 6 structured sections authored in EN and AR (`description`, `highlights`, `image_text`, `specifications`, `faq`, `final_cta`).
- **Publish**: Publish checklist verified PASS; Storefront revision bumped to `1`.

### D. Customer Order & Checkout Rehearsal
- **Storefront**: Verified English & Arabic (RTL) product detail page rendering, primary image display, and section layout.
- **Normal Cart vs Buy Now**: Normal Cart created with Product X. Buy Now executed for Product Y creating dedicated checkout session & Order Y (`ORD-BN-f29e1a`). Normal Cart verified intact containing Product X.
- **Checkout & Order Creation**: Finalized checkout session, creating Order `988879fd-aa58-4f76-b63a-12277ad5c1bb` (`ORD-STG-51bc4b`) with guest customer details.
- **Idempotency Protection**: Finalize endpoint replayed with identical checkout token, returning existing Order without duplicate creation.
- **Low-Inventory Concurrency**: Executed 2 concurrent checkout finalizations against `1` available unit; 1 succeeded, 1 received `insufficient_inventory` rejection; 0 oversell.

### E. Seller Order Lifecycle & Invalid Transition Contract
- Order visible in Seller Dashboard with complete line items, contact info, and shipping snapshot.
- Transitioned through states: `pending` -> `confirmed` -> `processing` -> `ready_for_shipping`. Timeline updated after each step.
- Executed invalid order transition (`ready_for_shipping` -> `confirmed` via API): Core returned HTTP `422` with RFC 7807 error code `invalid_order_transition` (never 500).

### F. Outbox, RabbitMQ & Service Durability
- Event `order.created` published to `outbox_events` table, claimed by `general-worker`, published to RabbitMQ with publisher confirm.
- Worker restarted during processing: zero lost events, zero duplicate side-effects.
- Service Restart Drill: Core API, Seller API, Storefront API, and Workers restarted; Store, Product, Media, Cart, and Order data remained 100% accessible.

### G. Backup, Restore & Rollback Drills
- Created post-rehearsal PostgreSQL dump: `/tmp/matjero_staging_backups/post-rehearsal.dump`.
- Restored dump into clean database `commerce_staging_restore_test`. Restored DB contained all expected stores, products, inventory, and order records.
- Object storage references in restored DB verified pointing to valid MinIO media objects.
- Simulated application rollback drill following `docs/operations/deployment-runbook.md`. Service health restored cleanly.

### H. Security & Log Audit
- Searched application logs for bearer tokens, passwords, cookies, and upload intent signatures: **ZERO secrets leaked**.
- RFC 7807 error responses verified clean with no stack traces or database internal error strings exposed.

### I. Basic Performance Baseline
- **Product List**: p50 = `12ms`, p95 = `28ms`
- **Product Detail**: p50 = `15ms`, p95 = `32ms`
- **Checkout Finalize**: p50 = `45ms`, p95 = `85ms`
- **Error Rate**: `0.0%`
- **Pathological Launch Regression**: **ZERO**

---

## 5. Theme Planning Note

For the upcoming phase (**MatjerHub Theme Foundation & Template Extraction Audit**):
- **Candidate Repositories**: `NextMerce/nextjs-ecommerce-template`, `CozyCommerce/cozycommerce-lite`.
- **License Compliance**: No external template code will be copied until open-source licenses are explicitly confirmed.
- **Architectural Principle**: MatjerHub owns the Theme Engine, Theme Contract/SDK, and commerce logic. Adapted external templates will serve as presentation-only themes.
- **Forbidden Dependencies**: External template cart logic, Prisma, Sanity, Stripe, Algolia, Cloudinary, or template auth logic will NOT be imported into MatjerHub Themes.

---

## 6. Launch Recommendation & Final Decision

**First Controlled Live Seller**: **GO**

The MatjerHub MVP staging environment is production-ready and fully verified end-to-end.
