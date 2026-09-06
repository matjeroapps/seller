# Theme Foundation & Template Strategy Audit — MatjerHub Storefronts

- **Date:** 2026-09-07
- **Phase:** Theme Foundation & Template Strategy Audit (audit only — no theme implementation, no P5.9)
- **Evidence heads:** Core `main` @ `1982c0f` (merge PR #35, hardening/mvp-first-live-store); Seller `main` @ `6637920` (merge PR #15, hardening/mvp-first-live-store). P5.8 work (Core PR #34, Seller PR #14) is merged to `main`.
- **UI/UX Tools Gate:** satisfied — UI/UX Pro Max skill v2.15.0 installed via `uipro init --ai antigravity` at workspace root (`.agents/skills/ui-ux-pro-max` et al.); `--design-system` and `--domain ux` searches executed against the bundled dataset for the storefront domain (results cited inline).

---

## Part A — Current-State Architecture (verified against code)

The platform is already substantially multi-theme-ready. The P4.7/P5.8 work built a real theme engine, not a hardwired storefront. Everything below was read from the working tree.

### A1. Core theme engine (Core repo)

| Capability | Evidence | Status |
|---|---|---|
| Pluggable theme model: `themes` (key, type `free\|premium`, status), `theme_versions` (immutable, `configuration_schema`, `default_configuration`, `component_registry_version`), `theme_installations` (one active per store, append-only history), `theme_configurations` (separate draft/published JSONB + revision counters) | `core/migrations/000007_theme_engine_schema.up.sql` | ✅ exists |
| Revision-based cache generations for storefront data | `core/migrations/000008_storefront_revisions.up.sql`; `X-Matjero-Storefront-Revision` handled in `seller/internal/coreclient/revision.go:22` | ✅ exists |
| Theme catalog seeded by the service (not migration) | referenced in `core/internal/coreapi/integration_test.go:104` | ✅ exists |

### A2. Seller API proxy (Seller repo, Go)

- Theme management routes already exist: `/v1/seller/themes`, `/v1/seller/themes/{key}/versions`, `/v1/seller/stores/{id}/theme{,/install,/draft,/publish,/discard,/upgrade,/preview}` — `seller/internal/sellerapi/themes.go`. All theme business logic (schema validation, draft/publish, preview-token signing) lives in Core; Seller is a pure proxy (`seller/internal/coreclient/themes.go` → Core `/internal/v1/themes*`). ✅ No Seller-side change needed to add a second theme.

### A3. Seller dashboard (Seller repo, `web/seller`)

- `src/components/ThemeCatalog.tsx` — lists platform themes + versions, install with confirmation. Already multi-theme capable.
- `src/components/ThemeEditorPanel.tsx` + `SchemaEditor.tsx` — schema-driven draft editor with save/publish/discard/upgrade and preview-token generation (`src/lib/preview.ts` → `theme_preview` param).
- Routes `#/themes` and `#/stores/theme` — `src/routes/Router.tsx:14-15,235-249`. Types mirror Core DTOs in `src/types/themes.ts` (`Theme.type` is `free|premium`).
- Section editing (P5.8) in `src/components/ProductsPanel.tsx` (`SECTION_TYPES` line 45, `validateSections()` line 83 mirroring backend per-type validators).

### A4. Storefront app (Seller repo, `web/storefront`)

- **Stack:** Next.js 16 App Router, React 19, `output: 'standalone'`, all pages server-rendered per request (no per-tenant SSG). Proxy (`src/proxy.ts`) sets `x-matjero-storefront-host`, resolves locale, and converts `theme_preview` → preview token (fail-closed on duplicates, `Cache-Control: private, no-store`).
- **Theme contract vocabulary:** `src/themes/contract.ts` — `ThemeTokens` (16-24), `ThemeSettings` (54-70), `ThemeContext` (132-149), view models incl. `sections {id, type, enabled?, sort_order, content}` (line 200), `ThemeComponents` (214-224: Layout, Home, ProductList, ProductDetail, Category, SearchResults, NotFound, Unavailable, ErrorState), `ThemeDefinition {key, versions[], components}` (227-236).
- **Registry:** `src/themes/registry.ts` — strict `(key, version)` resolution; unknown theme / unsupported version → generic unavailable state, **never silent fallback**. `src/themes/index.ts:16` registers one theme: `new ThemeRegistry().register(matjeroDefaultTheme, { asDefault: true })`. The module comment explicitly documents that a second theme is added by `register` with no loader/view-model changes — and `tests/theme-swap.test.tsx` proves the loaders are theme-agnostic.
- **Token pipeline:** `src/themes/settings.ts` — `DEFAULT_TOKENS` (line 30), hex validation, `SAFE_FONT_STACK`, `safeUrl()` (blocks `javascript:`/`data:`/protocol-relative), `normalizeThemeSettings()` (214), `cssVariablesFor()` (249) → CSS custom properties (`--color-primary`, `--font-body`, `--font-size-base`, `--spacing-section`, …) applied via React `style`, no stylesheet string injection.
- **Section renderers (P5.8):** `src/themes/matjero-default/ProductSections.tsx` — typed renderers for `description | highlights | image_text | specifications | faq | final_cta`; unknown types skipped (content problem, never a page problem); disabled sections never render.
- **Locale:** Core serves the public projection already locale-projected (sections resolve `media_id` → public uri/alt; no storage keys cross the boundary). Storefront `directionFor()` returns `rtl` for `ar`; store `supported_locales` ∩ platform locales; unpublished locale → 404.
- **Preview pipeline:** end-to-end theme draft preview with signed tokens, cache bypass, propagation covered by `tests/e2e/storefront-preview.spec.ts`.

## Part B — Findings (gaps that would block or degrade a second theme)

Ordered by severity. All line references verified in this audit.

1. **[P1] Version-compatibility policy is undefined.** `matjero-default/index.tsx` declares `versions: ['1.0.0']` and the registry resolves strictly. The moment Core mints a new `theme_versions` row for the same key (the schema invites it), every store on it renders the `unsupported_version` unavailable state. There is no documented policy for who bumps what, nor a compat matrix. The Core field `component_registry_version` exists and is the natural hook but is unused by the storefront.
2. **[P1] Platform fallback theme hardcoded.** `src/lib/view-models.ts:46` — `PLATFORM_DEFAULT_THEME = { key: 'matjero-default', version: '1.0.0' }`. A platform-level constant that names a specific theme belongs in configuration/registry metadata, not a lib file.
3. **[P2] Section renderers are private to `matjero-default`.** No shared section-rendering kit exists. Themes 2..n must either reimplement all six renderers (cost, contract-drift risk) or copy code (contradicts "no copied template code"). The switch statement lives inline at `ProductSections.tsx:167-188`.
4. **[P2] Theme vocabulary is a single-theme vocabulary.** `ThemeTokens`/`ThemeSettings`/`ThemeSettingsSchema` in `contract.ts` were shaped by the one existing theme. A second theme needing e.g. dark mode, radius, or imagery tokens requires a contract version — which interacts with finding 1.
5. **[P2] All themes compile into one bundle.** Registry registration is module-scope with static imports, so theme #N ships in the storefront's main JS for every request. Acceptable for two themes; a deliberate bundle strategy (dynamic import per theme key) is needed before theme #3.
6. **[P3] i18n leak in `final_cta`.** CTA labels are hardcoded inline (`ProductSections.tsx:153-154`, `'اشتري الآن'/'Buy Now'`) instead of coming from `context.copy` dictionaries; the `buy_now` label has no dictionary entry at all. Any second theme copying this pattern multiplies untranslated strings.
7. **[P3] Undocumented DOM contract.** `final_cta` anchors to `#purchase-control`, a `PurchaseControl.tsx`-internal id. This is a cross-component contract between theme parts; it must be a named export/contract constant so a second theme's Layout cannot silently break Buy Now.
8. **[P3] No theme asset/bundle policy.** Current theme uses inline styles + CSS variables only. A second theme wanting a stylesheet or font files needs a convention (Next.js import rules, CSP, font self-hosting vs Google Fonts) that does not exist yet.
9. **[Info] UX guardrails for selectable themes (UI/UX Pro Max dataset):** contrast ≥4.5:1 for body text in *each* seller-configurable color pairing, visible keyboard focus, `prefers-reduced-motion` respected, ≥44px touch targets, cursor-pointer/hover transitions 150-300ms. The `ThemeSettings` schema validates format today but not **contrast** — a seller can pick white-on-white today. Skill RTL search returned no verified RTL-specific guideline (4 layout results, off-topic); general guidance used: logical CSS properties + `directionFor()` already in place, keep it mandatory in the theme review checklist.

## Part C — Foundation Strategy (recommendation, not implementation)

**Recommended path: stay on the existing runtime-registry architecture. Do not adopt external templates or a build-time theme-per-tenant pipeline.**

Alternatives considered:
- *Token-only theming (CSS variables per seller, one layout):* cheapest, but the Core theme engine (versions, installations, schema, preview) already exceeds it; it would be a downgrade and contradicts the built P4.7 work.
- *External/commercial template adoption:* explicitly out of scope per phase rules, and would require sandboxing vendor JS.

**T1 — Freeze and formalize the theme contract (prereq for theme #2):**
- Extract the six section renderers from `matjero-default` into a shared section kit (registry of typed renderers) consumed by themes; themes compose/override rather than copy. Fixes finding 3.
- Promote `#purchase-control` to a contract-level constant (fixes 7); route all section CTA labels through `context.copy` (fixes 6).
- Define the version policy: theme declares supported versions; Core `component_registry_version` ↔ storefront registry mapping documented; deprecation = registry entry removal with a platform fallback constant that is configurable (fixes 1, 2).
- Extend `ThemeSettings` schema versioning now (add `theme_contract_version`), even if v1 fields don't change (fixes 4 preemptively).

**T2 — Second theme as the contract's proof:**
- Author one additional first-party theme (e.g. a compact "classic" layout) that consumes the shared section kit; add dynamic-import loading per theme key only if bundle analysis says so (finding 5 is a watch item, not a day-one need).
- Acceptance = the existing `theme-swap.test.tsx` pattern extended to the new theme + E2E storefront suite green under both themes, EN and AR.

**T3 — Seller-facing theme selection hardening:**
- Catalog thumbnails/live preview per theme (the preview-token pipeline already exists — reuse it).
- Add save-time contrast validation to `configuration_schema` (minimums per pairing) — this is a Core schema concern, surfaced automatically by the existing `SchemaEditor`.
- Theme review checklist per theme (a11y, RTL, 375px, reduced motion, LCP budget) recorded in docs before a theme ships.

**Explicitly out of scope (phase guards honored):** no P5.9 start, no payments, no shipping, no customer IAM, no external template code copied, no new PRs or branches opened for this audit.

## Part D — Status Report

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | UI/UX Tools Gate (skill installed AND used) | PASS | `uipro init --ai antigravity` OK (v2.15.0); `--design-system` + `--domain ux` searches run, cited in Part B.9 |
| 2 | Current-state architecture mapped with file/line evidence | PASS | Part A, all references verified in working tree at heads above |
| 3 | Single-theme blockers identified and severity-ranked | PASS | Part B items 1-9 |
| 4 | Foundation strategy for Seller-selectable themes produced | PASS | Part C (T1-T3), alternatives rejected with reasons |
| 5 | Scope guards respected (no P5.9/payments/shipping/IAM, no copied templates, no new PRs) | PASS | No code or branch changes made; report only |
| 6 | Second theme actually implemented | FAIL (by design) | Out of scope for this audit phase; Part C defines the path |
| 7 | RTL-specific UX guidance from skill dataset | FAIL (no verified match) | Dataset returned only off-topic layout results; general guidance labeled as such, per skill rules |

**Overall: audit complete. The foundation for multiple Seller-selectable themes already exists in Core (theme engine), Seller API (proxy), Seller dashboard (catalog + editor), and the storefront (strict versioned registry). The strategy is to formalize the contract (T1), prove it with one first-party second theme (T2), and harden seller-facing selection UX (T3) — all within existing architecture.**
