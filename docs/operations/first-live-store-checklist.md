# MatjerHub Operational Checklist — First Live Store

This checkbox-driven operational checklist must be verified before declaring the first real seller and store ready for live operations.

---

## Pre-Launch Infrastructure

- [ ] **DNS & Domain Routing**:
  - [ ] Platform domain (`matjero.com` or custom environment domain) points to TLS reverse proxy.
  - [ ] Wildcard subdomain routing (`*.matjero.com`) or custom storefront domain CNAME resolves to reverse proxy.
  - [ ] Browser requests carry authoritative host without untrusted header spoofing (`TRUSTED_FORWARDED_HOST=false` unless behind trusted ingress proxy).

- [ ] **TLS & Security**:
  - [ ] Valid TLS certificates issued for all public storefront and seller endpoints.
  - [ ] Strict-Transport-Security (HSTS) and security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`) active.
  - [ ] Cookies configured with `HttpOnly`, `Secure` (in HTTPS), `SameSite=Lax`, `Path=/`.

- [ ] **Database & Migrations**:
  - [ ] PostgreSQL 17 active with connection pooling.
  - [ ] All migrations up to `000016` applied cleanly (`000001` through `000016`).
  - [ ] Preflight validation: No duplicate active SKUs per variant (partial unique index `000016`).
  - [ ] Preflight validation: No duplicate storage keys (unique index `000015`).
  - [ ] Initial automated PostgreSQL backup created and tested with `pg_restore`.

- [ ] **S3 Object Storage**:
  - [ ] Real S3 bucket provisioned (e.g. AWS S3, Cloudflare R2, MinIO, Wasabi).
  - [ ] Bucket CORS policy configured allowing presigned `PUT` from Storefront and Seller origins.
  - [ ] Presigned upload URL generation and HeadObject verification confirmed operational.
  - [ ] Bucket versioning enabled for asset durability.

- [ ] **Events & Outbox**:
  - [ ] RabbitMQ 3.13 cluster active and reachable by Core and Seller workers.
  - [ ] Outbox publisher worker running with publisher confirms enabled.
  - [ ] Consumer inbox deduplication active across event handlers.

---

## Operational Environment

- [ ] **Environment Configuration Audit**:
  - [ ] Production environment (`APP_ENV=production`) verified on all services.
  - [ ] Fail-fast startup checks passed (no fallback to `localhost`, test credentials, or insecure defaults).
  - [ ] Secrets (S3 keys, DB passwords, service tokens, theme preview secret) injected securely from secret store.
  - [ ] Logs audited: Zero raw tokens, secret keys, cookies, or request payloads in log outputs.

- [ ] **Health & Monitoring**:
  - [ ] `/healthz` (liveness) and `/readyz` (readiness) endpoints passing on Core API, Seller API, Storefront API, and Workers.
  - [ ] Service process graceful shutdown tested on `SIGTERM` (in-flight HTTP requests complete cleanly, outbox worker releases leases).

---

## Store Provisioning & Commerce Flow

- [ ] **Seller & Store Bootstrap**:
  - [ ] Seller identity configured.
  - [ ] Store created with active market (`EG`), platform domain, and active fulfillment location with stock.

- [ ] **First Real Product Creation**:
  - [ ] Product authored with localized English and Arabic titles and descriptions.
  - [ ] Structured sections (all 6 supported section types) authored and validated.
  - [ ] Images uploaded via S3 presigned URLs, primary image set.
  - [ ] Price set in market currency (`EGP`).
  - [ ] Inventory allocated at fulfillment location.
  - [ ] Product published successfully.

- [ ] **Storefront & Order Lifecycle Smoke**:
  - [ ] Product live on English storefront (`/`) and Arabic storefront (`/ar`).
  - [ ] Customer executes Add to Cart and Buy Now workflows.
  - [ ] Checkout session finalized successfully creating Order.
  - [ ] Guest capability tokens (`matjero_guest_order_*`) grant access to created order only.
  - [ ] Order visible in Seller Dashboard.
  - [ ] Order transitioned through states: `confirmed` -> `processing` -> `ready_for_shipping`.

---

## Launch Authorization

- [ ] All checklist items above verified PASS.
- [ ] Pre-deployment database snapshot archived.
- [ ] Incident quick guide accessible to operators.
