# Matjero Seller

Seller Platform and Native Storefront for Matjero. This repository owns four
independently deployable runtime targets:

| Target | Path | Workspace / build arg |
| --- | --- | --- |
| `seller-api` | `apps/seller-api` | `APP_PATH=./apps/seller-api` |
| `seller-web` | `web/seller` | `@commerce/seller-web` |
| `storefront-api` | `apps/storefront-api` | `APP_PATH=./apps/storefront-api` |
| `storefront-web` | `web/storefront` | `@commerce/storefront-web` |

It depends on [`matjeroapps/core`](https://github.com/matjeroapps/core) for shared
domain logic (commerce, markets, storefront resolution, and the theme domain,
repository, validation and persistence layers), platform packages (auth, config,
database, httpx, i18n, money, observability, outbox/inbox), the actor router, and the
shared OpenAPI primitives. It owns no database migrations — those stay centralized in
`matjeroapps/core` `migrations/`, including `000007_theme_engine_schema`.

## Theme ownership boundary

The theme *domain* (models, repository, validation, persistence) lives in
`matjeroapps/core` `pkg/themes`. This repository owns the theme **HTTP surface**
(`internal/sellerapi/themes.go`), the seller dashboard theme screens, and storefront
rendering.

## Layout

| Path | Purpose |
| --- | --- |
| `apps/seller-api` | Seller HTTP service entrypoint |
| `apps/storefront-api` | Public storefront HTTP service entrypoint |
| `internal/sellerapi` | Seller + theme route registration and seller-only DTOs |
| `internal/openapi` | Seller and storefront OpenAPI documents (code-first) |
| `cmd/openapi-gen` | Regenerates both `docs/api/{seller,storefront}/openapi.json` |
| `web/seller` | Seller dashboard (Vite/React) |
| `web/storefront` | Native storefront (Next.js) |

## Local Development

```sh
cp .env.example .env
go build ./...
go test ./...
go run ./cmd/openapi-gen && git diff --exit-code -- docs/api
npm install
npm run lint
npm run typecheck
npm run test
```

`THEME_PREVIEW_SECRET` must be set for `seller-api` theme preview endpoints; when
unset they fail closed with `503 preview_unavailable`.

Infrastructure (PostgreSQL, Redis, RabbitMQ, ZITADEL) is provided by the
`docker-compose.yml` in `matjeroapps/core`.

## Cross-repository dependency

`go.mod` requires `github.com/matjeroapps/core` at a published version. Never
commit a `replace` directive pointing at a local path.

For side-by-side development, use a Go workspace file kept **outside** both
repositories (for example in their shared parent directory):

```sh
go work init ./core ./seller
```

`go.work` and `go.work.sum` are git-ignored so they can never be committed.

