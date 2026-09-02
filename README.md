# Matjero Seller

Seller Platform and Native Storefront for Matjero. This repository owns four
independently deployable runtime targets:

| Target | Path | Workspace / build arg |
| --- | --- | --- |
| `seller-api` | `apps/seller-api` | `APP_PATH=./apps/seller-api` |
| `seller-web` | `web/seller` | `@commerce/seller-web` |
| `storefront-api` | `apps/storefront-api` | `APP_PATH=./apps/storefront-api` |
| `storefront-web` | `web/storefront` | `@commerce/storefront-web` |

## Repository Independence Rule

This repository imports **no** Matjero Go module. It is independently cloneable,
buildable, testable, lintable, Docker-buildable, CI-runnable and deployable.

Every Core-owned business capability — commerce, markets, storefront resolution,
catalog, listings, inventory and the theme domain — is reached at runtime through
the Core internal HTTP API (`core-api`, `/internal/v1`) via this repository's own
client in `internal/coreclient`. See
[ADR-017](https://github.com/matjeroapps/core/blob/main/docs/plans/adr/ADR-017-repository-independence-and-runtime-service-boundaries.md).

Small generic technical helpers (config, httpx, i18n, money, auth, logging,
observability, actor router, OpenAPI primitives) are localized under `internal/`
rather than shared. Cross-repository DRY is deliberately sacrificed for
independence; business logic is never duplicated, only called.

This repository owns no database and no migrations. Migrations stay centralized
in `matjeroapps/core` `migrations/`.

## Theme ownership boundary

The theme *domain* (models, repository, validation, persistence, preview-token
signing) lives in `matjeroapps/core` `pkg/themes` and is reached through
`/internal/v1/themes/*` and `/internal/v1/stores/{id}/theme/*`. This repository
owns the theme **HTTP surface** (`internal/sellerapi/themes.go`), the seller
dashboard theme screens, and storefront rendering.

## Layout

| Path | Purpose |
| --- | --- |
| `apps/seller-api` | Seller HTTP service entrypoint |
| `apps/storefront-api` | Public storefront HTTP service entrypoint |
| `internal/sellerapi` | Seller + theme route registration and seller-only DTOs |
| `internal/storefrontapi` | Public storefront route registration and DTOs |
| `internal/coreclient` | This repository's HTTP client for the Core internal API |
| `internal/openapi` | Seller and storefront OpenAPI documents (code-first) |
| `cmd/openapi-gen` | Regenerates both `docs/api/{seller,storefront}/openapi.json` |
| `web/seller` | Seller dashboard (Vite/React) |
| `web/storefront` | Native storefront (Next.js) |

## Native storefront

`web/storefront` is a multi-tenant Next.js application. One deployment serves every store:
tenant identity is the customer host, which it forwards to `storefront-api` as the outgoing
`Host` header, and every page is server-rendered per request. It consumes only the six
public `/v1/storefront/*` routes and holds no commerce logic of its own.

Presentation comes from a theme registry that maps a published theme key and version onto a
component set, so switching themes changes no catalog, routing or tenant code. See
[docs/implementation/storefront-rendering-report.md](docs/implementation/storefront-rendering-report.md).

It requires `STOREFRONT_API_BASE_URL`, the private service address of `storefront-api`. That
value is server-only and never reaches the browser.

## Local Development

```sh
cp .env.example .env
GOWORK=off go build ./...
GOWORK=off go test ./...
GOWORK=off go run ./cmd/openapi-gen && git diff --exit-code -- docs/api
npm install
npm run lint
npm run typecheck
npm run test
```

All verification uses `GOWORK=off` so the repository behaves identically whether
or not a local Go workspace exists.

`seller-api` and `storefront-api` require `CORE_API_BASE_URL` and
`CORE_API_TOKEN`; both refuse to start without them. The token must match
`CORE_INTERNAL_SELLER_TOKEN` on the Core side.

Infrastructure (PostgreSQL, Redis, RabbitMQ, ZITADEL) is provided by the
`docker-compose.yml` in `matjeroapps/core`. Seller itself connects to none of
them: it has no database.

## Cross-repository dependency

There is none. `go.mod` requires no `github.com/matjeroapps/*` module other than
this repository itself, and no Go file imports another Matjero repository. CI
enforces this on every push.

A Go workspace file may still be used for side-by-side development, kept
**outside** every repository (for example in their shared parent directory):

```sh
go work init ./core ./seller
```

`go.work` and `go.work.sum` are git-ignored so they can never be committed, and
no repository may require one.

