# MatjerHub Deployment Runbook — First Live Store

This runbook defines the operational deployment sequence for launching the first real store on MatjerHub.

---

## 1. Prerequisites & Preflight Checks

Before deploying to production:

1. **Verify Environment Variables**:
   - Ensure all critical environment variables are set (`APP_ENV=production`, `DATABASE_URL`, `RABBITMQ_URL`, `CORE_API_BASE_URL`, `CORE_API_TOKEN`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `ZITADEL_ISSUER`, `STOREFRONT_COOKIE_SECURE=true`).
   - Confirm production services will fail fast at startup if any critical credential or endpoint is missing.

2. **Pre-deployment Database Backup**:
   - Take an explicit snapshot backup of PostgreSQL before executing migrations:
     ```bash
     pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE -F c -b -v -f /backups/pre-deploy-$(date +%Y%m%d%H%M%S).dump
     ```

3. **Verify Health Endpoints**:
   - Verify container runtime health checks are active (`/healthz` for liveness, `/readyz` for readiness).

---

## 2. Deployment Sequence

To avoid zero-downtime database lock issues, execute services in the following order:

1. **Apply Core Database Migrations**:
   ```bash
   # Execute migrations from 000001 up to current 000016
   migrate -path ./migrations -database "$DATABASE_URL" up
   ```

2. **Deploy Core Infrastructure Services**:
   - Deploy `Core API` (`apps/core-api`).
   - Verify `/readyz` returns HTTP 200 OK.
   - Deploy background workers (`apps/workers/general-worker`) and `scheduler`.

3. **Deploy Seller & Storefront Backend APIs**:
   - Deploy `Seller API` (`apps/seller-api`).
   - Deploy `Storefront API` (`apps/storefront-api`).
   - Verify both return HTTP 200 OK on `/readyz`.

4. **Deploy Web Applications**:
   - Deploy `Seller Dashboard Web` (`web/seller-dashboard`).
   - Deploy `Storefront Web` (`web/storefront`).

---

## 3. Post-Deployment Verification (Smoke Tests)

Execute the following verification steps immediately after deployment:

1. **Health Verification**:
   - `curl -f https://core.internal/readyz`
   - `curl -f https://seller.internal/readyz`
   - `curl -f https://storefront.internal/readyz`

2. **Storefront & Catalog Verification**:
   - Load store domain on Storefront Web.
   - Verify product detail rendering in English and Arabic.
   - Execute test Add to Cart and Checkout session.

---

## 4. Rollback Plan

If a critical failure occurs post-deployment:

1. **Application Rollback**:
   - Immediately roll back container images to the previous release tags in reverse deployment order (Web -> APIs -> Workers -> Core API).

2. **Database Rollback Decision**:
   - **No Live Data Written**: Roll back database migrations (`migrate down 1`).
   - **Live Writes Occurred**: Do NOT run destructive down migrations. Restore from the pre-deployment PostgreSQL backup:
     ```bash
     pg_restore -h $PGHOST -U $PGUSER -d $PGDATABASE --clean --if-exists /backups/pre-deploy-TIMESTAMP.dump
     ```
