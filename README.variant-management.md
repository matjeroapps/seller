# Variant management implementation baseline

This worktree implements the Stitch-driven product variant flow. The Seller
web app uses Vitest for unit/component tests, Playwright for browser coverage,
and `npm run typecheck --workspace @commerce/seller-web` for TypeScript.

The Core boundary is served by the independent Core repository. Variant removal
is a catalog removal with history preservation; Active/Inactive/Archive are not
merchant-facing variant actions.
