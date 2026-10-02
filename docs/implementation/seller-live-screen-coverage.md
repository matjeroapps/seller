# Seller Live Screen Coverage & Evidence Matrix

**Feature Spec**: [019-seller-live-screens](specs/019-seller-live-screens/spec.md)
**Status**: PASS
**Verified Commit**: `5f27042`
**Date**: 2026-10-02T06:59:40+03:00

## Summary Counts

- **Total Approved Design Records**: 28
- **App Screen Records**: 26
- **Unique Route Paths**: 24
- **Non-Route Assets**: 2
- **Live / Partial / Unavailable / Asset Breakdown**:
  - Live: 11
  - Partial: 4
  - Setup Required: 0
  - Unavailable: 11
  - Asset: 2
- **Overall Status**: 28/28 PASS (Full static, unit, API contract, TypeScript build, and state coverage verified)

---

## 28-Record Evidence Matrix

| Design ID | Title / Destination | Classification | Seller API / Core Capability | Store Scope | Allowed Roles | Primary Actions | Empty Behavior | Error / Unavailable Behavior | Test ID | Full-Stack Result | Live/Manual Result | Status | Commit & Date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `6cacb65351564341a4c1401391f6bd2b` | Store Overview `/dashboard/stores/{store_id}` | live | `GET /api/seller/v1/stores/{store_id}/dashboard` | Store-scoped | owner, manager, staff | View overview, filter range | Empty cards/charts | State error handling | `dashboard-model.test.ts` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `6cefceb506614982a45a3e0cfa9efacc` | Store Dashboard `/dashboard/stores/{store_id}` | live | `GET /api/seller/v1/stores/{store_id}/dashboard` | Store-scoped | owner, manager, staff | View metrics | Empty metrics | State error handling | `dashboard-model.test.ts` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `7c3b66c38b0a439795ff2223d2800830` | Products List `/dashboard/stores/{store_id}/catalog/products` | live | `GET /api/seller/v1/stores/{store_id}/catalog/products` | Store-scoped | owner, manager, staff | Browse products, archive | Empty list with create CTA | Error notice | `api-client-contracts.test.ts` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `5e73823eb2b84a1e937b20a2a38b0a22` | Create Product `/dashboard/stores/{store_id}/catalog/products/new` | live | `POST /api/seller/v1/stores/{store_id}/catalog/products` | Store-scoped | owner, manager | Create product | N/A | Form validation & API error | `api-client-contracts.test.ts` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `c71723a2f55648f59ab40f014b53f95c` | Supplier Offers `/dashboard/stores/{store_id}/catalog/supplier-offers` | live | `GET /api/seller/v1/stores/{store_id}/catalog/supplier-offers` | Store-scoped | owner, manager, staff | Browse & import offers | Empty catalog list | Filter & import error | `router_test.go` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `defa5b29119d49ed9967973a9140a418` | Inventory `/dashboard/stores/{store_id}/inventory` | live | `GET/POST /api/seller/v1/stores/{store_id}/inventory/adjustments` | Store-scoped | owner, manager, staff | View & adjust stock | Empty stock list | Adjustment error notice | `router_test.go` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `d5da3f954a144aa9afda5b07d88dd3cb` | Media Library `/dashboard/stores/{store_id}/media` | live | `GET/POST/DELETE /api/seller/v1/stores/{store_id}/media` | Store-scoped | owner, manager, staff | Upload, delete media | Empty dropzone | Upload failure notice | `router_test.go` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `73d90e6ca6a248ecbec00ad239d9735a` | Orders List `/dashboard/stores/{store_id}/orders` | live | `GET /api/seller/v1/stores/{store_id}/orders` | Store-scoped | owner, manager, staff | Filter & view orders | Empty orders state | Load failure banner | `orders.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `424d89c31b134fc2a4f289e55fb20bda` | Order Detail `/dashboard/stores/{store_id}/orders/{order_id}` | live | `GET/PUT /api/seller/v1/stores/{store_id}/orders/{order_id}` | Store-scoped | owner, manager, staff | Transition status, create shipment | N/A | Transition error notice | `orders-fulfillment.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `ed5b5420fae24e6db8d75329f1e8c0cc` | New Order Shell `/dashboard/stores/{store_id}/orders/new` | unavailable | None (unsupported manual orders) | Store-scoped | owner, manager, staff | View alternative orders link | Clean unavailable card | Explains manual order missing | `capability-state.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `ff4c1d6815b74cf68e80c9ff8bc1a84e` | Documents `/dashboard/stores/{store_id}/orders/{order_id}/documents` | partial | GET order facts / Print browser markup | Store-scoped | owner, manager, staff | Print packing slip / invoice | N/A | PDF/ZATCA export unavailable | `live-operations-screens.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `5ceeb286adbe468988c686b24ab1da8d` | Shipments `/dashboard/stores/{store_id}/shipments` | partial | `GET/POST /api/seller/v1/stores/{store_id}/shipments` | Store-scoped | owner, manager, staff | Select order & create shipment | Empty shipments state | Store-wide shipment list unavailable | `orders-fulfillment.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `478f8f92cdfe40cf80886f8fd8757eab` | Carts `/dashboard/stores/{store_id}/carts` | unavailable | None (unsupported carts) | Store-scoped | owner, manager, staff | View orders alternative | Clean unavailable card | Explains cart tracking missing | `capability-state.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `1f334d8bdad54aefbd7bed5eb96cfc21` | Customers `/dashboard/stores/{store_id}/customers` | unavailable | None (unsupported customers) | Store-scoped | owner, manager, staff | View orders alternative | Clean unavailable card | Explains customer management missing | `capability-state.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `1b8dda660f134587a47a06314ce74595` | New Customer `/dashboard/stores/{store_id}/customers/new` | unavailable | None (unsupported customer creation) | Store-scoped | owner, manager | View orders alternative | Clean unavailable card | Explains customer creation missing | `capability-state.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `237be697ef1443e9b91185890783a370` | Finance Overview `/dashboard/stores/{store_id}/finance` | live | `GET /api/seller/v1/stores/{store_id}/finance/wallet` | Store-scoped | owner, manager | View wallet & settlements | Zero balance & zero payouts | Finance service unavailable notice | `router_test.go` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `17f36244d1844164b44ddcd20b367ef2` | New Payout Request `/dashboard/stores/{store_id}/finance/payouts/new` | unavailable | None (unsupported payout request) | Store-scoped | owner | View finance alternative | Clean unavailable card | Explains manual payout request missing | `capability-state.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `33f3feaf951c4457abda24ed0eab0d2c` | Integrations `/dashboard/stores/{store_id}/integrations` | live | `GET/POST /api/seller/v1/stores/{store_id}/integrations` | Store-scoped | owner, manager | Connect integration, generate key | Empty active integrations | Integration error notice | `router_test.go` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `2f0f555364c2499ca0eb20106644027e` | Store Settings `/dashboard/stores/{store_id}/settings` | partial | `GET /api/seller/v1/stores/{store_id}/settings` | Store-scoped | owner, manager | View operational store facts | N/A | Tax/policy edit unavailable | `live-operations-screens.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `26eb0d93e46c4dbebc6a0ad23f33a6f1` | Account Profile `/dashboard/stores/{store_id}/account` | partial | `GET/PUT /api/seller/v1/profile` | Global / User | owner, manager, staff | Save user profile | N/A | 2FA/sessions unavailable | `live-operations-screens.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `38895d30b510491fbb8e60981b8e97a6` | Notifications `/dashboard/stores/{store_id}/notifications` | unavailable | None (unsupported notifications) | Store-scoped | owner, manager, staff | View account alternative | Clean unavailable card | Explains notification feed missing | `capability-state.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `bf9ce524deb64412a64ef9688429837e` | Team / Users `/dashboard/stores/{store_id}/users` | unavailable | None (unsupported team mgmt) | Store-scoped | owner | View settings alternative | Clean unavailable card | Explains team management missing | `capability-state.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `cbb6e6cdd7344c62b023c3644a98bfb6` | Billing Shell A `/dashboard/stores/{store_id}/billing` | unavailable | None (unsupported billing) | Store-scoped | owner | View finance alternative | Clean unavailable card | Explains billing/plans missing | `capability-state.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `ecee261b51834999ae3a6513047e95d6` | Billing Shell B `/dashboard/stores/{store_id}/billing` | unavailable | None (unsupported billing) | Store-scoped | owner | View finance alternative | Clean unavailable card | Explains billing/plans missing | `capability-state.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `f211c59b08a6439d8181ed25c5abc541` | Analytics `/dashboard/stores/{store_id}/analytics` | unavailable | None (unsupported analytics) | Store-scoped | owner, manager | View dashboard alternative | Clean unavailable card | Explains analytics export missing | `capability-state.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `f44bf2a9fe894e8588b728e68020ed84` | Storefront & Themes `/dashboard/stores/{store_id}/storefront` | live | `GET/POST /api/seller/v1/stores/{store_id}/storefront` | Store-scoped | owner, manager | Install/publish theme | Empty custom themes | Theme error notice | `theme-catalog.test.tsx` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `cc2a635b61244038b532a6ced210873f` | Brand Logo Asset | asset | Brand logo asset | Non-route | N/A | Rendered asset | N/A | N/A | `screen-registry.test.ts` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
| `cc8331289828447385c2725e039aaa4c` | Avatar Image Asset | asset | Default avatar image asset | Non-route | N/A | Rendered asset | N/A | N/A | `screen-registry.test.ts` | PASS | PASS | PASS | `5f27042` 2026-10-02 |
