# Storefront Rendering

The customer-facing rendering layer of the native storefront: `web/storefront`, a Next.js
16 App Router application that serves many stores from one deployment.

## Architecture

```
Customer
   ↓  HTTPS, customer host
Next.js storefront (this app)
   ↓  HTTP, Host: <customer host>
Seller storefront-api
   ├─ Core revision probe
   ├─ Redis response cache
   └─ HTTP
        ↓
      core-api
        ↓
   CatalogRepository
        ↓
    PostgreSQL
```

The frontend consumes the six public storefront routes and nothing else. It never calls
`core-api`, never imports a Core Go package, never reads a migration, and never re-derives
a commerce rule: availability, eligibility, filtering, pagination, search and the public
price are all Core-owned and arrive as data (ADR-017).

TypeScript contracts for those payloads are hand-written in `src/lib/contracts.ts` rather
than generated from Core's OpenAPI document, because consuming another repository's
artifacts at build time is exactly what Repository Independence forbids. The duplication is
the accepted cost.

## Route tree

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/` | dynamic | Resolves the store, redirects to its default locale |
| `/{locale}` | dynamic | Home |
| `/{locale}/products` | dynamic | Product listing |
| `/{locale}/products/{slug}` | dynamic | Product detail |
| `/{locale}/categories/{slug}` | dynamic | Category |
| `/{locale}/search` | dynamic | Search |
| `/robots.txt` | dynamic | Tenant-scoped crawler directives and sitemap link |
| `/sitemap.xml` | dynamic | Tenant-scoped locale, category and product URLs |
| `_not-found` | dynamic | Storefront 404 and the store-unavailable state |

Every route is server-rendered per request. Nothing is statically generated per tenant and
no build-time tenant list exists, so one deployment serves any number of stores.

```
src/app/
  layout.tsx                     document: lang + dir
  page.tsx                       /  → default locale
  not-found.tsx                  404 and unavailable
  error.tsx                      error boundary (client, for reset)
  [locale]/
    layout.tsx                   locale allowlist
    (store)/
      layout.tsx                 tenant + theme resolution, store chrome
      page.tsx                   home
      products/page.tsx
      products/[slug]/page.tsx
      categories/[slug]/page.tsx
      search/page.tsx
  robots.ts                     tenant-scoped robots response
  sitemap.ts                    tenant-scoped sitemap response
```

`(store)` is a route group, so it adds no URL segment. Its layout is where the tenant is
resolved, which is what lets the not-found boundary above it distinguish an ordinary 404
inside a healthy store from a store that does not resolve at all.

## Tenant handling

Tenant identity is the customer host and nothing else. It is read from the incoming server
request in `src/server/tenant.ts` and forwarded to `storefront-api` as the outgoing `Host`
header; `storefront-api` normalizes it again and hands it to Core's store resolver. No
store id, seller id, query parameter, cookie or client-side value participates.

`X-Forwarded-Host` is honored only when `TRUSTED_FORWARDED_HOST=true`, mirroring the
setting of the same name on `storefront-api`, so the web app never establishes a weaker
trust boundary than the service behind it.

SEO absolute URLs use `X-Forwarded-Proto` only under that same trust setting. Otherwise
`STOREFRONT_PUBLIC_PROTOCOL` selects `http` for local development or defaults to `https`.

Two properties keep tenants isolated:

- No module-level tenant state. The API client is stateless and every read takes the host
  as an argument, so one process serving many stores has nowhere to leak one into another.
- Request-scoped memoization. `React.cache` keys the store bootstrap on `(host, locale)`,
  so a page whose layout, header, footer and body all need store context issues one call,
  and a concurrent request for a different host gets its own entry.

Tests cover both: two hosts resolved through one module instance produce two different
stores, currencies, themes and category sets.

## Server-side API client

`src/lib/api.ts` is the client. It is `server-only`, so importing it from a Client
Component is a build error rather than a runtime leak.

It uses `node:http`/`node:https` rather than `fetch`. This is not a preference: WHATWG
`fetch` treats `Host` as a forbidden header and silently drops it in any casing (verified),
and `Host` is the one signal that works under both of `storefront-api`'s proxy policies.

Responses are read defensively. The body is size-bounded at 1 MiB, parsed inside a
try/catch, and checked for the expected shape before use, so a malformed upstream response
becomes a typed error instead of a render crash. Errors are classified as `not_found`,
`invalid_request`, `unavailable` or `unexpected`; the message is for server logs only and
no page renders it.

Path segments are percent-encoded and query values go through `URLSearchParams`, so a slug
containing `../` or a keyword containing `&` cannot alter a request.

## Theme registry

```
(themeKey, themeVersion)
        ↓
   ThemeRegistry
        ↓
  ThemeComponents
```

`src/themes/registry.ts` maps a published `(key, version)` pair onto a component set. A
theme is code that ships inside this application and is *selected* by data; no seller value
is ever executed.

Resolution is strict. An unregistered key gives `unknown_theme`; a version no registered
component set declares gives `unsupported_version`. Neither falls back to a different
version, because a configuration written against one version is not safe to interpret with
another. Both outcomes render the generic unavailable page. A store with no theme
installation at all is not an error: the platform default renders with its own defaults.

The contract a theme receives is in `src/themes/contract.ts`: view models only. A theme
component cannot fetch, cannot compute a price and cannot see which service produced its
data. `src/lib/view-models.ts` is the single place a payload becomes something a theme
renders, which is what makes a swap a presentation change.

The swap test registers a stub second theme with unrelated markup and renders the same
models through both component sets. No commerce, fetching or mapping code differs.

## Default theme

`matjero-default` @ `1.0.0` — one production theme, mobile-first, product-focused.

Configuration comes from Core's published theme schema and only from it. Supported fields:
`logo`, `favicon`, `colors.{primary,secondary,background,text}`,
`typography.{font_family,base_size}`, `announcement_bar`, `header.{layout,show_search}`,
`footer.columns`, `navigation.style`, `hero`, `homepage_sections`, `product_card_layout`,
`category_layout`, `spacing`. No frontend-invented setting exists.

Configuration is data. `src/themes/settings.ts` normalizes it before a theme sees it:

- Colors must match `^#[0-9a-fA-F]{6}$` or the default applies.
- Font stacks are restricted to characters that cannot terminate a CSS declaration.
- URLs are limited to `http`, `https` and rooted paths; `javascript:`, `data:`,
  protocol-relative and malformed values are dropped.
- Enums, integer ranges and lengths are enforced, and `homepage_sections` is bounded.
- Every field has a default, because Core's schema makes all of them optional.

Tokens reach the page as CSS custom properties through React's `style` prop, never as a
stylesheet string. There is no `eval`, no `new Function`, and no seller JavaScript, CSS or
React anywhere in the rendering path. Product JSON-LD is emitted by the server from the
public product contract using JSON serialization; it is not seller-authored markup.

The homepage is composed from `homepage_sections`, which carries no data selectors — no
category slugs, no product lists. Each section kind therefore maps to a fixed query:
`featured` → newest products, `product_carousel` → cheapest products, `category_grid` →
top-level categories. Nothing fabricates reviews, ratings, discounts or bestseller
signals, because the public contract has no such data.

## Localization

`src/i18n/locales.ts` holds full `en` and `ar` dictionaries for every customer-visible
string the storefront owns: navigation, labels, filters, pagination, empty states, 404,
unavailable and error copy. Both locales are declared against one type, so a missing key is
a type error.

Catalog content is never translated here. `storefront-api` returns product and category
text in the requested locale, and re-translating it would duplicate a Core responsibility.

Routing is locale-prefixed. `/` resolves the store first and redirects to *its* market
default — `/ar` for an Egyptian store, `/en` for a Saudi one — never a hardcoded locale.
The locale set is the intersection of the store's published locales and the ones this build
has dictionaries for, so a market advertising an unimplemented locale never routes to it.

`lang` and `dir` are set on `<html>` by the root layout, as real attributes rather than a
CSS rule, because bidirectional text, logical properties, caret movement and keyboard
navigation follow the document direction. The stylesheet uses logical properties
throughout, so one stylesheet lays out both directions with no mirrored copy.

The locale switch preserves the current path, so switching language on a product page lands
on the same product.

## Server/client boundary

The storefront ships almost no JavaScript for interaction. The mobile menu is a
`<details>` element; search, filter and sort are `<form method="get">`. Both work without
JavaScript and keep browse state in the URL, which is what makes every listing
server-rendered, shareable and back-button correct.

`error.tsx` is the only Client Component, because React needs its `reset` callback on the
client. It renders no failure detail: the error message and digest can name the internal
service address.

Server modules are marked `server-only`. `STOREFRONT_API_BASE_URL` is deliberately not a
`NEXT_PUBLIC_*` variable, so the private service address cannot reach a browser bundle.

## Request interception

`src/proxy.ts` uses the `proxy` file convention, which replaced `middleware` in Next.js 16
(the build warns that `middleware.ts` is deprecated and names `proxy.ts` as its
replacement). This is the framework-version adaptation the Phase spec anticipated.

It does two things: it strips every inbound `x-matjero-*` header so a client cannot forge
one, and it publishes the locale segment and the path within it. The root layout sits above
`[locale]` and cannot read that parameter, yet it must set `lang` and `dir`; the locale
switch needs the path to build equivalent links.

Tenant resolution deliberately does not happen here. Resolving it in the proxy would mean
fetching the bootstrap twice per request, once in the proxy and again in the render.

## Cache interaction

The Redis cache in `storefront-api` is the application cache, and its correctness comes
from the Core revision in its key. This app adds no second cache layer that could outlive a
revision change: reads go through `node:http` and are not subject to the framework's fetch
cache, every route is dynamic, and no `revalidate` window is configured. Deliberate
framework revalidation is left to later work; correctness first.

## Failure states

| Situation | Response | Rendered |
| --- | --- | --- |
| Unknown domain | 404 | Store unavailable |
| Store no longer resolving publicly | 404 | Store unavailable |
| Locale the store does not publish | 404 | Store unavailable |
| Theme key or version not supported | 404 | Store unavailable |
| Unknown product or category | 404 | Storefront 404, chrome intact |
| Path matching no route | 404 | Storefront 404, chrome intact |
| Rejected filter or sort | 200 | Empty result state |
| Service unreachable or timed out | 500 | Generic error, retry |

Unknown and inactive are intentionally indistinguishable, and the unavailable page names no
reason: not the moderation state, not the seller, not the store code, not the theme.

Two deviations are worth stating plainly:

- A rejected browse parameter renders the catalog or an empty result rather than an error.
  Values that cannot be valid are dropped during parsing, so a stale link shows products;
  only a value that parsed but the service rejected reaches the empty state.
- A service outage surfaces as HTTP 500, not 503. The App Router has no supported way for a
  page to set a response status other than through the 404 and error interrupts, so 503 is
  not expressible here. The customer-facing text is correct ("try again") and no internal
  detail leaks; the status code is the compromise.

## Framework behaviour worth knowing

Next.js 16.3 server-renders the not-found boundary for a router-decided 404 — a path that
matches no route — but for a 404 raised by `notFound()` inside a page or layout it emits an
empty `<html id="__next_error__">` shell and delivers the boundary UI in the flight payload,
which the client then renders. Verified in this app, in an isolated reproduction, on 16.3.3
and 16.3.4, and under both Turbopack and webpack.

The consequence: the store-unavailable page and product/category 404s return the correct
status and render correctly in a browser, but their body is not in the initial HTML. A
client with JavaScript disabled sees an empty body on those paths. Successful pages are
unaffected and fully server-rendered.

Related: a sibling `loading.tsx` or a `Suspense` boundary above a route that calls
`notFound()` makes it return HTTP 200 (upstream issue). No `loading.tsx` is used above these
routes for that reason.

## Media

Public media URLs come from the API and are rendered with `<img>`, not `next/image`.
Tenant media hosts are seller-controlled and unbounded, so the image optimizer's
`remotePatterns` allowlist cannot be configured without either enumerating hosts that do
not exist yet or opening a wildcard — which turns the optimizer into an open proxy for
arbitrary remote URLs. Images are lazy-loaded, `decoding="async"`, and constrained by
`aspect-ratio` so a grid does not shift as they arrive. Nothing is proxied through Go.

Every URL is validated before rendering, so an unsafe scheme cannot reach `src`. Product
images fall back to the product name for alt text, which is more useful than a generic
label; the decorative hero image is `alt=""` and `aria-hidden`.

## Accessibility baseline

Semantic landmarks (`banner`, `navigation`, `main`, `contentinfo`), each navigation
landmark uniquely named. One `h1` per page and no skipped heading levels. A skip link to
`#main`. Labelled search and filter controls. Real `<button>` for submission and real `<a>`
for navigation. Meaningful alt text, `aria-hidden` on decoration. Visible focus rings via
`:focus-visible`. `aria-current` on the active locale. `prefers-reduced-motion` respected.

Not a WCAG conformance claim; no automated audit was run.

## Testing

Vitest with Testing Library and jsdom, in `web/storefront/tests`. Run by
`npm run test --workspaces`, alongside the existing locale-foundation check, so CI executes
both.

| File | Covers |
| --- | --- |
| `api-client.test.ts` | Host forwarding, locale, encoding, error classification, malformed and oversized responses, timeouts |
| `tenant.test.ts` | Host normalization, forwarded-host trust policy, runtime config |
| `proxy.test.ts` | Internal header publication and inbound stripping, matcher |
| `presentation.test.ts` | Locale sets, theme resolution, unavailable reasons, tenant isolation |
| `theme-registry.test.ts` | Key and version resolution, unknown theme, defaults |
| `theme-settings.test.ts` | Configuration application, defaults, colour/font/URL rejection, enum and range clamping |
| `theme-swap.test.tsx` | Stub second theme rendering the same models |
| `catalog-query.test.ts` | URL parsing, bounds, round-tripping, injection safety |
| `view-models.test.ts` | Price formatting, card and context mapping |
| `pages.test.tsx` | Home, listing, category, detail, search, 404, unavailable, store isolation |
| `localization.test.tsx` | Dictionary parity, translation completeness, `lang`/`dir`, translated chrome |
| `privacy.test.tsx` | No wholesale price, supplier, fee, margin, fulfillment or SKU id in output |
| `accessibility.test.tsx` | Landmarks, headings, labels, alt text, keyboard operability |
| `landmarks.test.tsx` | Unique accessible names per landmark, both locales |
| `seo.test.ts` | Canonicals, locale alternates, `x-default`, search `noindex`, product JSON-LD and safe descriptions |

The privacy fixtures deliberately carry internal-looking fields the public API does not
return, proving the rendering path cannot surface one even if a payload contained it.

Fixtures are written in this repository. Core test data is never imported.

## Docker

`docker/web-app.Dockerfile` gained a `storefront` runtime stage. `output: "standalone"`
produces a self-contained server plus its traced dependencies, so the stage installs
nothing and carries no source tree. It runs as the unprivileged `node` user, exposes 3000,
and takes every value from the environment — `STOREFRONT_API_BASE_URL` is required at
runtime and never baked into a layer.

```sh
docker build -f docker/web-app.Dockerfile --target storefront \
  --build-arg WORKSPACE=@commerce/storefront-web -t matjero-storefront-web:local .
```

Verified: the image builds in this repository alone, runs as `node`, and serves every route
against a stub `storefront-api`. Roughly 290 MB, ~40 MB of application content.

The seller dashboard image now builds `--target build`, which is what it always used.

## Performance notes

Observed on a production build served from the standalone output:

- One storefront API call per logical need. The home page issues bootstrap, categories and
  its section queries in parallel; the category page fetches category and products
  together; the breadcrumb parent comes from the already-loaded category tree.
- The bootstrap payload is fetched once per request, not once per component.
- Seven script tags, all framework runtime. No component in the rendering path is a Client
  Component except the error boundary, so a catalog page hydrates nothing.
- One stylesheet, 138 rules.
- Product grids use `repeat(auto-fill, minmax(...))`, so they adapt by available width
  rather than by breakpoint guesswork. No horizontal overflow at 390 px.
- Keep-alive connection pooling to `storefront-api`, bounded at 64 sockets.

Dedicated performance hardening is later work.

## Known limitations

- `notFound()`-raised 404s do not server-render their body (framework behaviour, above).
  Affects the unavailable page and unknown product/category paths.
- Service outages surface as 500 rather than 503.
- `next/image` is not used; see Media.
- The locale switch preserves the path but not the query string, so switching language on a
  filtered listing returns to the unfiltered first page.
- `homepage_sections` carries no data selectors, so section content is a frontend-chosen
  query per kind rather than a merchant-curated list. `featured` is the newest products
  because Core exposes no featured signal.
- Section titles come from seller configuration and are single-valued, so a store serving
  two locales sees the same title in both. The theme schema has no per-locale field.
- Category navigation is capped at twelve top-level categories and the footer at five.
- `store.settings` is free-form and unvalidated, so no UI depends on any key in it.
- No automated accessibility audit; the tests assert structure, not conformance.

## Out of scope

Seller theme management — editor, browser, install, publish, preview, seller auth — is a
later unit. This layer only consumes published theme data.

Custom domain lifecycle is a later unit; this layer renders whatever active host already
resolves. Cart, checkout, payment, shipping and customer accounts are Phase 5+.
