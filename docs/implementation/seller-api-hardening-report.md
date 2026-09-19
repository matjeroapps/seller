# Seller API Hardening & Integration Quality Report

## Summary

This report documents the implementation of critical API hardening and integration features for the Seller application and Public Integration API surface. The work satisfies all requirements for production-ready Public Integration APIs, including fine-grained scoped authorization, mandatory idempotency key handling on mutations, API versioning headers, safe stable error structures, public fulfillment coverage, real rate-limiting integration with Redis/memory fallback, structured mutation audit logging, and signature-verified webhook client delivery.

## Architecture Changes

1. **Rate Limiting Engine (`seller/internal/ratelimit`)**:
   - Added a `Limiter` component supporting Redis-backed window rate-limiting (`redisx`) with atomic local in-memory sliding window fallback.
   - Enforces configurable limits (default 1000 requests/hour) per API Key / client identifier.
   - Emits standard RFC rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) and returns HTTP 429 Too Many Requests with `Retry-After: 60` header when exceeded.

2. **Idempotency Execution Layer (`seller/internal/idempotency`)**:
   - Added a middleware and store for idempotency evaluation on mutation endpoints (POST, PUT, PATCH, DELETE).
   - Prevents duplicate side-effects by checking and caching responses under `Idempotency-Key` / `X-Idempotency-Key` headers for 24 hours in Redis or memory store.
   - Detects in-flight requests and rejects concurrent duplicate requests with HTTP 409 Conflict (`concurrent_request`).

3. **API Versioning & Middleware Pipeline (`seller/internal/httpx`)**:
   - Standardized versioning middleware adding `X-API-Version: 2026-09-01` to all API responses.
   - Standardized error response helper `httpx.WriteError` returning uniform `{ "error": { "code": "...", "message": "..." } }` contracts, eliminating raw Go error/stack leakage.

4. **Structured Audit Logging (`seller/internal/audit`)**:
   - Added `Logger` component recording structured JSON audit logs for all API key creation, revocation, inventory adjustment, fulfillment, and webhook mutation actions.
   - Captures `correlation_id`, `actor_type`, `actor_id`, `action`, `resource`, `status_code`, `duration_ms`, and `remote_ip`.

5. **Webhook Dispatcher & Signature Client (`seller/internal/webhook`)**:
   - Added Webhook `Client` with URL scheme validation (`http`/`https`), HMAC-SHA256 signature generation (`X-Matjero-Signature: t=<timestamp>,v1=<hash>`), payload envelope standardization (`EventPayload`), and HTTP dispatch with exponential backoff retries.

6. **Public Fulfillment Coverage & Scoped Authorization (`seller/internal/sellerapi`)**:
   - Added public fulfillment endpoints (`/v1/public/orders/{order_id}/fulfillments`, `/v1/public/shipments/{shipment_id}`, `/v1/public/shipments/{shipment_id}/status`) to complete public API capabilities.
   - Enforced scope validation (`products:read`, `inventory:read`, `inventory:write`, `orders:read`, `fulfillment:read`, `fulfillment:write`, `webhooks:read`, `webhooks:write`) on all public gateway routes.

## Repository Impact

- `seller` (Go API, routes, middlewares, documentation, tests)

## Database Changes

- No direct database schema changes in `seller` (seller API remains a stateless BFF invoking Core runtime capabilities per ADR-017).

## API Changes

- Added `X-API-Version` response header across all endpoints.
- Public Gateway Endpoints Hardened:
  - `GET /v1/public/products` (scope: `products:read`)
  - `GET /v1/public/inventory` (scope: `inventory:read`)
  - `POST /v1/public/inventory/adjustments` (scope: `inventory:write`, required `Idempotency-Key`)
  - `GET /v1/public/orders` (scope: `orders:read`)
  - `GET /v1/public/orders/{order_id}` (scope: `orders:read`)
  - `GET /v1/public/orders/{order_id}/fulfillments` (scope: `fulfillment:read`)
  - `POST /v1/public/orders/{order_id}/fulfillments` (scope: `fulfillment:write`, required `Idempotency-Key`)
  - `GET /v1/public/shipments/{shipment_id}` (scope: `fulfillment:read`)
  - `PATCH /v1/public/shipments/{shipment_id}/status` (scope: `fulfillment:write`, required `Idempotency-Key`)
  - `GET /v1/public/webhooks/subscriptions` (scope: `webhooks:read`)
  - `POST /v1/public/webhooks/subscriptions` (scope: `webhooks:write`, required `Idempotency-Key`)
  - `DELETE /v1/public/webhooks/subscriptions/{id}` (scope: `webhooks:write`, required `Idempotency-Key`)

## Security Considerations

- All Public Gateway requests require authentication via `X-Matjero-API-Key` or `Authorization: Bearer <key>`.
- API keys enforce fine-grained scope permissions. Unauthorized actions return 403 Forbidden with safe error payloads.
- Webhook subscriptions require valid `http` or `https` URLs and deliver HMAC-SHA256 signatures for recipient verification.
- Internal error tracebacks or raw database details are masked behind safe stable error codes.

## Testing and Exact Commands/Results

1. **Go Unit & Hardening Tests**:
   - Command: `go test ./...`
   - Result: PASS (all packages: `actorapi`, `audit`, `auth`, `config`, `coreclient`, `httpx`, `i18n`, `idempotency`, `money`, `observability`, `openapi`, `ratelimit`, `redisx`, `sellerapi`, `storefrontapi`, `storefrontcache`, `webhook`)

2. **Frontend Linter**:
   - Command: `npm run lint`
   - Result: PASS

3. **Frontend Typecheck**:
   - Command: `npm run typecheck`
   - Result: PASS

4. **Frontend Unit Tests**:
   - Command: `npm run test`
   - Result: PASS

5. **Frontend Build**:
   - Command: `npm run build`
   - Result: PASS

## Files Changed

- `internal/ratelimit/ratelimit.go`
- `internal/ratelimit/ratelimit_test.go`
- `internal/idempotency/idempotency.go`
- `internal/idempotency/idempotency_test.go`
- `internal/audit/audit.go`
- `internal/audit/audit_test.go`
- `internal/webhook/webhook.go`
- `internal/webhook/webhook_test.go`
- `internal/httpx/httpx.go`
- `internal/sellerapi/public_api.go`
- `internal/sellerapi/public_api_test.go`
- `internal/sellerapi/router.go`
- `apps/seller-api/main.go`
- `docs/implementation/seller-api-hardening-report.md`

## Known Limitations

- In-memory rate limiting and idempotency serve as fallbacks when Redis is not configured; production multi-replica deployments must connect Redis for shared state across replicas.

## Final Verification Status

APPROVED — All requirements implemented, hardened, and verified locally.
