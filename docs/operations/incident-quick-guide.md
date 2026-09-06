# MatjerHub Incident Quick Guide — First Live Store

This guide provides immediate diagnostic steps for on-call operators responding to operational incidents during first live store operation.

---

## 1. Storefront Unavailable (HTTP 5xx / 404 / Connection Timeout)

### Immediate Diagnostic Steps:
1. **Check Readiness**:
   ```bash
   curl -i https://storefront.internal/readyz
   ```
2. **Check Core API Connection**:
   - Inspect Storefront API logs for `coreapi` connection errors (`dial tcp`, `context deadline exceeded`).
3. **Domain & Host Resolution**:
   - Verify request `Host` header corresponds to an active store domain in Core.
   - Check if `PLATFORM_DOMAIN` matches the request host.

---

## 2. Seller Dashboard Unavailable

### Immediate Diagnostic Steps:
1. **Check Seller API Health**:
   ```bash
   curl -i https://seller.internal/readyz
   ```
2. **Check OIDC Auth Provider**:
   - Verify Zitadel / OIDC issuer (`ZITADEL_ISSUER`) is reachable and returning JWKS keys.

---

## 3. Database Outage / Connection Failures

### Immediate Diagnostic Steps:
1. **Check PostgreSQL Service**:
   ```bash
   pg_isready -h $PGHOST -p 5432 -U commerce
   ```
2. **Check Connection Pool Metrics**:
   - Inspect Core logs for `pgxpool` exhaustion or `too many clients` errors.

---

## 4. RabbitMQ / Event Outbox Backlog

### Immediate Diagnostic Steps:
1. **Check Outbox Worker Status**:
   - Verify `general-worker` process is running.
2. **Inspect Outbox Events Table**:
   ```sql
   SELECT count(*) FROM outbox_events WHERE published_at IS NULL;
   ```
3. **Check RabbitMQ Management / Ping**:
   ```bash
   rabbitmq-diagnostics -q ping
   ```

---

## 5. S3 Media Upload Failures

### Immediate Diagnostic Steps:
1. **Check CORS Headers**:
   - Verify S3 bucket CORS allows `PUT` from Storefront and Seller origins.
2. **Check Credentials & Region**:
   - Verify `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY`, `MEDIA_S3_ENDPOINT`, and `MEDIA_PUBLIC_BASE_URL`.
3. **Verify Upload Intent Expiry**:
   - Upload intents expire after 15 minutes (`MEDIA_PRESIGN_TTL`).

---

## 6. Checkout / Order Finalization Failures

### Immediate Diagnostic Steps:
1. **Check Inventory & Price Lock**:
   - Verify inventory is available at the store's active fulfillment location.
   - Inspect Core API logs for `insufficient_inventory` or `price_changed` errors.
2. **Check Session Expiry**:
   - Checkout sessions expire after 30 minutes.

---

## 7. Order Missing from Seller Dashboard

### Immediate Diagnostic Steps:
1. **Verify Database Record**:
   ```sql
   SELECT id, store_id, status, created_at FROM orders WHERE id = '<order_id>';
   ```
2. **Verify Seller Tenant Isolation**:
   - Ensure the authenticated seller owns the store (`store_id`) associated with the order.
