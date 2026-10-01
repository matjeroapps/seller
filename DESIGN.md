# Seller Dashboard Design System

Source: Google Stitch project `10181626586509106537`, screen `Seller Dashboard Overview`.

## Principles

- Build the seller dashboard as an operations console, not a marketing page.
- Use real seller data from the current store scope. If an optional API section fails, show the section as unavailable instead of inventing metrics.
- Keep primary actions close to their operational context: activate/deactivate store, pause/resume checkout, add product, visit storefront, import offers, adjust inventory, connect channels, and open finance.
- Preserve tenant-safe routing under `/dashboard/stores/{store_id}` for store-scoped actions.

## Visual Tokens

- Heading font: Plus Jakarta Sans.
- Body font: Inter.
- Primary: `#0D5C46`.
- Secondary: `#0284C7`.
- Accent: `#10B981`.
- Background: `#FAF8FF`.
- Text: `#131B2E`.
- Controls: 8px radius.
- Cards and panels: 12px radius maximum.
- Layout rhythm: 8px spacing scale.

## Layout

- Left sidebar with MatjerHub mark, store switcher, and nested Catalog navigation.
- Top bar with breadcrumb, catalog search command, language direction toggle, theme toggle, notifications, help/settings, and profile menu.
- Store hero with status, market, currency, storefront host, checkout state, and the most common seller actions.
- KPI row for Products, Orders, Published Listings, and Available Payout.
- Main operations column for Attention Center, readiness/flow, and recent orders.
- Right rail for Quick Actions, Stock Alerts, Connected Channels, and Settlement Ledger.

## Interaction Notes

- Use lucide icons for command buttons and navigation.
- Keep all shell and dashboard styles scoped to seller classes.
- Support responsive mobile navigation with an overlay drawer.
- Use CSS logical properties where possible so direction switching remains viable.
