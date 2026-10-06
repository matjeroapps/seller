# Store-Scoped Categories: Compatibility Decision Record

**Feature**: [030-store-scoped-categories](../../specs/030-store-scoped-categories/spec.md) (workspace repo) | **Date**: 2026-10-06 | **Status**: Decided

## Decision

**Coexistence — store-scoped categories are introduced as a new, separate data set. Platform-global categories remain exactly as they are, with no schema change and no data migration.**

- New tables: `store_categories`, `store_category_translations`, `store_product_categories` (Core migration `000044`, purely additive).
- The pre-existing `categories`, `category_translations`, and `product_categories` tables are untouched. `GET /internal/v1/categories` (admin+seller listing) and `POST /internal/v1/categories/{id}/status` (admin) keep their current behavior.
- Seller-facing store category endpoints (`/internal/v1/stores/{storeID}/categories…`) read and write only the new tables; global category records are structurally incapable of appearing in their responses.

## Alternatives considered and rejected

1. **Add a nullable `store_id` to the global `categories` table** — mixes admin-owned and seller-owned records in one table, forces reworking the global `slug UNIQUE` constraint, and makes "never expose admin-only records through seller endpoints" a query-discipline problem instead of a structural guarantee.
2. **Migrate global categories into store categories** — would change what storefront category pages render (they derive from global `product_categories`), violating the no-silent-storefront-breakage requirement. No data exists to migrate in the local stack, and fabricating per-store copies of global records would fabricate catalog data.

## Compatibility consequences (accepted)

1. **Storefront unchanged in this feature.** Live storefronts continue to render global categories exactly as before. Wiring the storefront to render store-scoped categories is a follow-up, separately-scoped effort (per clarification 2026-10-06, the storefront repo was not in scope).
2. **Legacy global product assignments are frozen but preserved.** Products keep whatever global `category_ids` assignments they had; those still drive storefront category pages. The Seller Portal no longer renders or sends `category_ids` — the update path treats an absent field as "untouched", so existing assignments survive every seller save. They can still be managed through the admin/supplier surfaces.
3. **Products assigned only to store categories will not appear on storefront *category* pages** until the future storefront wiring ships. Their product detail pages, search, and cart behavior are unaffected. This is the one visible trade-off of coexistence and is accepted for this feature's scope.
4. **The Seller BFF `GET /v1/seller/stores/{store_id}/categories` response shape changed** (bare array of global `{id, slug, status}` → `CollectionResponse` of store-category nodes). Its only consumer — the product detail category picker — was rewritten in the same change set, so no external consumer exists.

## Follow-ups (out of scope here)

- Storefront rendering of store-scoped categories, including per-locale (EN/AR) display and the `status='active'` + ancestor-chain visibility filter defined in the feature's data model.
- Decide whether storefront *category pages* should union global and store categories during a transition period.
- Outbox/search events for store categories (`commerce.store_category.*`) when a consuming projection exists.
