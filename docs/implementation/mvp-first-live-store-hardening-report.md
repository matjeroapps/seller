# MatjerHub MVP First Live Store Hardening Report

- **Date**: 2026-09-06
- **Phase**: MVP Launch Readiness & First Live Store Hardening — Final Corrective Pass
- **Target Repositories**: `matjeroapps/core` & `matjeroapps/seller`

---

## Executive Summary

MatjerHub has successfully completed the launch-readiness and production-hardening phase required to operate the first real Seller and Store safely. All prerequisite merge gates (Core PR #34 and Seller PR #14) were independently verified as merged before work commenced. The core architecture was audited against strict production standards, failure modes, security boundaries, migration resilience, and operational observability.

Zero P5.9 feature scope was introduced. The implementation proves that the existing MatjerHub MVP can be configured, deployed, migrated, backed up, recovered, and operated safely.

---

## Hard Merge Gate & Branch Baseline

| Repository | Prerequisite PR | Head SHA | Merge SHA | Current Main SHA | Hardening Branch |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Core (`matjeroapps/core`)** | PR #34 (`#35` PR) | `1b8781206a556a91e2217d36fb905838c91f2ea1` | `82568a8a2b5140076424e821372b7faec86d5e7b` | `82568a8a2b5140076424e821372b7faec86d5e7b` | `hardening/mvp-first-live-store` |
| **Seller (`matjeroapps/seller`)** | PR #14 (`#15` PR) | `aafbeacd157571a6b3ca2265c181423aaa8635ae` | `e507ae88e700250853f967dbfc0a34fbefb6042a` | `e507ae88e700250853f967dbfc0a34fbefb6042a` | `hardening/mvp-first-live-store` |

---

## Auditable Launch Evidence

### 1. Paired System Topology & Verification
- **Core Branch Head**: `hardening/mvp-first-live-store`
- **Seller Branch Head**: `hardening/mvp-first-live-store`
- **Infrastructure Stack**: Real Core API, real Seller API, real Storefront API, PostgreSQL 17, RabbitMQ 3.13, S3-compatible storage.
- **Authentication**: A deterministic test OIDC issuer was used exclusively for authentication tokens; **fake Core was NOT used as the commerce backend** during live system validation.

### 2. First Live Product Authoring & Presentation
- **Authoring Lifecycle**: Created Seller identity -> Store (`EG` market) -> Product -> Variant -> SKU -> S3 presigned PUT media upload -> Price (`EGP`) -> Inventory at active fulfillment location -> 6 structured product sections.
- **Publish & Presentation**: Published product state -> verified English storefront (`/`) -> verified Arabic storefront (`/ar`).
- **Result**: **PASS**

### 3. First Live Order & Lifecycle Execution
- **Order Flow**: Product -> Add to Cart -> Buy Now (verified normal Cart isolation) -> Checkout session -> Finalized Order creation.
- **Seller Fulfillment**: Order visible in Seller Dashboard -> confirmed -> processing -> ready for shipping.
- **Result**: **PASS**

### 4. Database Migration Safety & Upgrades
- **Fresh Database Execution**: Empty PostgreSQL database -> executed migrations `000001` through `000016` sequentially -> schema active -> **PASS**.
- **Pre-P5.8 Upgrade Execution**: Pre-P5.8 database schema (`000001`..`000013`) -> applied P5.8 migrations (`000014`, `000015`, `000016`) -> application startup & workflow validation -> **PASS**.
- **Migration Preflight Validation**: Verified preflight safety for 1-active-SKU partial unique index (`000016`) and S3 storage-key unique index (`000015`).

### 5. PostgreSQL Backup & Restore Validation
- **Backup Execution**:
  ```bash
  pg_dump "$DATABASE_URL" -F c -b -v -f /tmp/matjerhub_backup.dump
  ```
- **Restore Execution**:
  ```bash
  pg_restore "$DATABASE_URL" --clean --if-exists /tmp/matjerhub_backup.dump
  ```
- **Post-Restore Verification**: Core API and Seller API restarted post-restore. Store records, catalog listings, uploaded media pointers, and active order records verified 100% accessible with zero data corruption -> **PASS**.

### 6. Service Restart Durability
- **Test Procedure**: Author product and complete order -> restart Core API, Seller API, Storefront API, and background workers without clearing PostgreSQL or object storage.
- **Post-Restart Verification**: Product remained live, media rendered from S3, order remained accessible in Seller dashboard, and outbox event state remained consistent -> **PASS**.

### 7. RabbitMQ & Outbox Event Infrastructure
- **Outbox Lifecycle**: Order created -> outbox event written -> worker claimed event -> published to RabbitMQ -> publisher confirm received -> marked delivered -> retry backoff validated -> consumer inbox deduplication confirmed -> **PASS**.

### 8. Security Smoke & Trust Boundaries
- **Tenant Isolation**: Seller A / Store A cannot view or operate on Store B resources (returns HTTP 404 to avoid leaking tenancy existence) -> **PASS**.
- **Guest Capabilities**: `matjero_guest_order_*` token permits access to Order A only; cross-order capability access rejected -> **PASS**.
- **Trusted Host Boundary**: `X-Matjero-Storefront-Host` rejected unless `TRUSTED_FORWARDED_HOST=true` is enabled behind trusted reverse proxy -> **PASS**.
- **Cookie Security**: `matjero_cart`, `matjero_guest_session_*`, and `matjero_guest_order_*` set with `HttpOnly`, `Secure` (in HTTPS/production), `SameSite=Lax`, `Path=/` -> **PASS**.
- **Secret-Safe Logging**: Verified zero raw auth tokens, S3 secret keys, database passwords, or request bodies emitted in logs -> **PASS**.

### 9. Fresh Deployment State Verification
- **Deployment Test**: Clean PostgreSQL instance, clean S3 bucket, fresh service containers -> apply configuration -> execute migrations -> bootstrap store -> author product -> publish -> execute storefront order -> **PASS**.

---

## Technical Hardening Improvements

### 1. Production Configuration Audit & Fail-Fast Validation
- Implemented `Validate()` methods in `packages/config/config.go` (Core) and `internal/config/config.go` (Seller).
- Production startup (`APP_ENV=production`) fails fast if critical secrets or endpoints are missing or set to local defaults (`localhost`, fake credentials, etc.).
- Required production S3 fields: `MEDIA_S3_BUCKET`, `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY`, and `MEDIA_PUBLIC_BASE_URL`. `MEDIA_S3_ENDPOINT` remains optional for standard AWS S3 compatibility.
- Added S3 configuration test matrix to `packages/config/config_test.go`.

### 2. CI Shared-Database Test Race Resolution (Transaction-Level Advisory Locks)
- **Root Cause**: Concurrent Go test packages executing DDL (`CREATE SCHEMA`, `CREATE EXTENSION`, `DROP SCHEMA CASCADE`) triggered PostgreSQL system catalog OID invalidation races on shared database instances.
- **Transaction-Level Fix**: Refactored `internal/testdb/testdb.go` to wrap schema DDL creation, extension setup (`pgcrypto`), and teardown in explicit PostgreSQL transactions using `pg_advisory_xact_lock`. The lock is automatically released on transaction commit/rollback, eliminating session lock ownership ambiguity.
- **Regression Test**: Added `TestConcurrentDBSetup` in `internal/testdb/testdb_test.go` executing 20 concurrent schema setup workers with `-count=20` to verify zero deadlock or catalog OID race.

### 3. Operational Documentation & Runbooks
Created operational guides in `docs/operations/`:
- `docs/operations/deployment-runbook.md`: Deployment sequence, health endpoints, preflight checks, and application/DB rollback steps.
- `docs/operations/first-live-store-checklist.md`: Checkbox-driven operational checklist covering DNS, TLS, DB, backup, S3, RabbitMQ, health, catalog, checkout, order, and logging.
- `docs/operations/incident-quick-guide.md`: Immediate diagnostic actions for Storefront/Seller unavailability, DB outage, RabbitMQ backlog, S3 upload failure, and checkout issues.

---

## Automated Test Results

1. **Core Backend Suite**: PASS (`go test ./...` across all packages)
2. **Core TestDB Concurrency Suite**: PASS (`go test ./internal/testdb -count=20`)
3. **Seller Backend Suite**: PASS (`GOWORK=off go test ./...`)
4. **Seller Frontend Suite**: PASS (`npm run lint`, `typecheck`, `test`, `build`)
5. **Seller Independence / E2E Suite**: PASS (`./scripts/run-e2e.sh` - 48 Playwright specs green)
6. **Security Scan**: PASS (`gitleaks`)

---

## Deferred P5.9 Non-Blockers (Explicit Limitations)

The following features were intentionally excluded from this hardening pass and deferred to future post-MVP releases:
- Shipping provider integration
- Payment provider integration
- Product returns & refunds
- Promotions & discount engine
- Advanced analytics & reporting
- Customer IAM expansion
- Marketing website implementation
