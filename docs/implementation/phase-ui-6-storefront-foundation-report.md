# Phase UI-6 Storefront Foundation Report

## Scope

Phase UI-6 adds a customer-facing storefront foundation to the Seller frontend without backend integrations. The Seller Management Portal remains under `/dashboard/*`; customer storefront routes are isolated under `/store/[slug]/*`.

Implemented routes:

- `/store/[slug]`
- `/store/[slug]/products`
- `/store/[slug]/search`

## UX Decisions

The storefront uses mock commerce data to exercise production-grade browsing patterns before product APIs, orders, payments, inventory, or seller workflows exist in this phase.

The shell includes store identity, primary navigation, search, language switching, customer account placeholder, and cart placeholder. The home page establishes store branding, featured products, categories, promotions, and footer patterns. Product listing adds grid, filtering, sorting, and pagination placeholders. Search includes prompt, no-results, suggestions, and results states.

## ui-ux-pro-max Usage

The `ui-ux-pro-max` design-system search was run with:

```bash
python3 /var/www/personal/matjero/.agents/skills/ui-ux-pro-max/scripts/search.py "ecommerce marketplace storefront responsive" --design-system -p "MatjerHub Storefront" --density 6 --motion 3 --variance 4
```

The selected direction was a balanced, conversion-focused marketplace storefront with clear hierarchy, responsive product grids, subtle motion, green commerce trust cues, and orange promotion accents. The implementation avoids decorative single-hue treatment and keeps focus, contrast, and responsive behavior explicit.

## Architecture

Customer storefront code lives in the Seller Next.js app:

- `web/seller/app/store/[slug]/page.tsx`
- `web/seller/app/store/[slug]/products/page.tsx`
- `web/seller/app/store/[slug]/search/page.tsx`
- `web/seller/components/storefront/*`
- `web/seller/lib/storefront/mock-data.ts`

The storefront does not import dashboard shell components and the dashboard does not import storefront components.

## Component Ownership

Shared generic UI remains owned by `@matjerhub/ui-sdk`.

Used from `@matjerhub/ui-sdk`:

- `Button`
- `Card`
- `Badge`
- `Input`
- `EmptyState`

Kept in Seller because they are storefront-specific compositions:

- `StorefrontShell`
- `StorefrontHome`
- `ProductListing`
- `StorefrontSearch`
- `ProductCard`
- `CategoryCard`

No local `components/ui/*` primitives were introduced, and no UI SDK release was needed for this phase.

## Accessibility And Responsive Behavior

The storefront uses semantic `header`, `nav`, `main`, `section`, `aside`, `footer`, form labels, `role="search"`, and named navigation regions. RTL/LTR is applied at the storefront shell level through `lang` and `dir`, with Arabic copy available through the URL language switcher.

Responsive behavior is defined for desktop, tablet, and mobile through CSS grid changes. Product grids collapse from four columns to three, two, and one column. Header search and actions reflow without depending on dashboard layout styles.

## SEO Foundation

The route pages use the Next.js Metadata API for dynamic store, products, and search titles. Placeholder Store and Product JSON-LD are emitted from mock data only, preparing the surface for future indexing without introducing backend calls.

## Verification

Completed locally from `web/seller`:

- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm run test` - passed, 3 test files and 9 tests
- `npm run build` - passed

Browser rendering checks were run with Playwright against the local dev server at `http://localhost:3011`:

- Desktop home: `/store/modern-home?lang=en`, 1440px wide, LTR, no horizontal overflow
- Mobile products: `/store/modern-home/products?lang=en`, 390px wide, LTR, no horizontal overflow
- RTL search: `/store/modern-home/search?lang=ar&q=مصباح`, 768px wide, RTL, no horizontal overflow
