# Theme Platform Foundation Architecture (v1.0)

This document details the hardened Theme Platform architecture for MatjerHub storefronts following Phase T2.5 implementation.

## 1. Theme Architecture Overview

The MatjerHub storefront theme system isolates theme presentation from underlying storefront business logic, data fetching, and checkout workflows. Themes present normalized view models received via props and never perform side effects or data mutations directly.

```
themes/
 ├── shared/                      # Shared business & UI components
 │   ├── ProductSections.tsx
 │   ├── PurchaseControl.tsx
 │   └── constants.ts
 ├── tokens/                      # Structured theme design tokens & CSS generation
 │   ├── index.ts
 │   ├── matjero-default.tokens.ts
 │   └── matjero-boutique.tokens.ts
 ├── matjero-default/             # Platform Default Theme
 │   ├── Layout
 │   ├── pages
 │   └── chrome
 ├── matjero-boutique/            # Editorial Luxury Boutique Theme
 │   ├── Layout
 │   ├── pages
 │   └── chrome
 ├── contract.ts                  # Theme definition contracts & capability metadata
 ├── preview.ts                   # Theme preview context contracts
 ├── registry.ts                  # Strictly validated theme registry
 └── settings.ts                  # Theme configuration normalization
```

---

## 2. Forbidden Dependencies & Isolation Rules

- **Zero Theme-to-Theme Imports**: No theme is allowed to import from another theme directory.
  - **Forbidden**: `import { PurchaseControl } from '../matjero-default/PurchaseControl'` inside `matjero-boutique`.
  - **Enforced via Automated Tests**: `tests/theme-isolation.test.ts` validates that `matjero-boutique` contains zero references to `matjero-default`.

---

## 3. Shared Component Rules

All reusable product interaction and layout section components must reside under `src/themes/shared/`:
- **`PurchaseControl`**: Handles quantity selection, variant picking, Add to Cart API calls, and Buy Now checkout initialization.
- **`ProductSections`**: Shared modular section rendering engine (description, highlights, image-text, specifications, FAQ, final CTA).

---

## 4. Theme Design Tokens System

Themes define visual tokens in `src/themes/tokens/` following a standardized contract:

```ts
export type ThemeTokens = {
  colors: { background, foreground, primary, secondary, accent },
  typography: { heading, body },
  spacing: { xs, sm, md, lg, xl },
  radius: { sm, md, lg }
};
```

Rendering consumes CSS variables generated via `tokensToCssVariables(tokens)`:
- `--theme-primary`
- `--theme-background`
- `--theme-radius-md`
- `--theme-spacing-md`

No theme component should use hardcoded inline styles for structure, typography, or visual tokens.

---

## 5. Theme Capability Contract

Every theme exports a `ThemeDefinition` including a `ThemeCapabilities` metadata record:

```ts
capabilities: {
  supportsRTL: true,
  supportsProductSections: true,
  supportsSearch: true,
  supportsCategories: true
},
compatibilityVersion: "1.0"
```

---

## 6. Guide: Adding a New Theme

1. Create a new directory under `src/themes/matjero-<theme_name>/`.
2. Define `matjero-<theme_name>.tokens.ts` under `src/themes/tokens/`.
3. Implement `chrome.tsx` (Header, Footer, Announcement) and `pages.tsx` (Home, ProductDetail, ProductList, Category, SearchResults, NotFound, Unavailable, ErrorState).
4. Sourcing shared components from `src/themes/shared/` only.
5. Export `matjero<ThemeName>Theme` implementing `ThemeDefinition`.
6. Register the theme in `src/themes/index.ts` via `themeRegistry.register(matjero<ThemeName>Theme)`.

---

## 7. Theme Marketplace Future Path

The Theme Registry and Capability Contracts provide the prerequisite safeguards for third-party theme support:
- **Registry Validation**: Prevents key collisions, validates required capabilities, and rejects incompatible schema versions.
- **Preview Contracts**: `ThemePreviewContext` defines token-driven, non-destructive preview rendering for seller dashboard theme customization.
