# Seller Portal Stitch Design QA

Date: 2026-10-02

## Reference

- Google Stitch project: `10181626586509106537`
- Stitch MCP source: `list_screens` for project `10181626586509106537`, plus `get_screen` for `projects/10181626586509106537/screens/26eb0d93e46c4dbebc6a0ad23f33a6f1`
- Implemented screenshot: `/home/ahmed/.codex/visualizations/2026/10/01/01a0f825-3716-7f01-9dee-fcccae200f6f/seller-implementation/seller-dashboard-implemented.png`

## Result

Route and shell coverage pass.

The initial Seller Dashboard still follows the Stitch layout direction:

- Seller-specific sidebar with store switcher and nested Catalog navigation.
- Operations top bar with breadcrumb, catalog search command, language direction toggle, theme toggle, notifications, help/settings, and profile menu.
- Store hero with status, market, currency, storefront host, checkout state, and core seller actions.
- KPI row, Attention Center, readiness panel, Recent Orders, Quick Actions, Stock Alerts, Connected Channels, and Settlement Ledger.

The public Stitch project now contains a wider Arabic RTL seller portal screen set. The Seller portal has been updated so the designed destinations resolve to first-class store-scoped routes instead of 404s or generic foundation placeholders.

## Stitch Screen Coverage

| Stitch MCP screen | Screen id | Seller route | Implementation status |
| --- | --- | --- | --- |
| `لوحة تحكم التاجر - نظرة عامة (Arabic RTL)` | `6cacb65351564341a4c1401391f6bd2b` | `/dashboard/stores/{store_id}` | Implemented in the merged dashboard PR with live seller data fallbacks. |
| `Seller Dashboard Overview` | `6cefceb506614982a45a3e0cfa9efacc` | `/dashboard/stores/{store_id}` | Earlier English overview mapped to the same operational dashboard destination. |
| `قائمة المنتجات والكتالوج - متجر هب` | `7c3b66c38b0a439795ff2223d2800830` | `/dashboard/stores/{store_id}/catalog/products` | Existing API-backed product catalog route. |
| `إضافة منتج جديد` | `5e73823eb2b84a1e937b20a2a38b0a22` | `/dashboard/stores/{store_id}/catalog/products/new` | Existing API-backed product creation route. |
| `عروض الموردين والتوريد بالجملة - متجر هب` | `c71723a2f55648f59ab40f014b53f95c` | `/dashboard/stores/{store_id}/catalog/supplier-offers` | Existing API-backed supplier offers route. |
| `إدارة المخزون والمستودعات - متجر هب` | `defa5b29119d49ed9967973a9140a418` | `/dashboard/stores/{store_id}/inventory` | Existing API-backed inventory route. |
| `مكتبة الوسائط والملفات الرقمية - متجر هب` | `d5da3f954a144aa9afda5b07d88dd3cb` | `/dashboard/stores/{store_id}/media` | Existing media route. |
| `قائمة وإدارة الطلبات - متجر هب` | `73d90e6ca6a248ecbec00ad239d9735a` | `/dashboard/stores/{store_id}/orders` | Existing API-backed order list route. |
| `تفاصيل الطلب والشحن اليدوي - #MH-98412` | `424d89c31b134fc2a4f289e55fb20bda` | `/dashboard/stores/{store_id}/orders/{order_id}` | Existing API-backed order detail and fulfillment route. |
| `إنشاء طلب جديد - متجر هب` | `ed5b5420fae24e6db8d75329f1e8c0cc` | `/dashboard/stores/{store_id}/orders/new` | Added Stitch-aligned Arabic RTL route shell. |
| `معاينة وطباعة بوليصة الشحن وملصق العنوان والفاتورة ZATCA - #MH-98412` | `ff4c1d6815b74cf68e80c9ff8bc1a84e` | `/dashboard/stores/{store_id}/orders/{order_id}/documents` | Added Stitch-aligned Arabic RTL route shell. |
| `إدارة الشحنات والخدمات اللوجستية - متجر هب` | `5ceeb286adbe468988c686b24ab1da8d` | `/dashboard/stores/{store_id}/shipments` | Existing API-backed shipments route. |
| `إدارة السلات الشرائية - السلات النشطة والمتروكة - متجر هب` | `478f8f92cdfe40cf80886f8fd8757eab` | `/dashboard/stores/{store_id}/carts` | Added Stitch-aligned Arabic RTL route shell. |
| `إدارة العملاء وقاعدة البيانات - متجر هب` | `1f334d8bdad54aefbd7bed5eb96cfc21` | `/dashboard/stores/{store_id}/customers` | Added Stitch-aligned Arabic RTL route shell. |
| `إضافة عميل جديد - متجر هب` | `1b8dda660f134587a47a06314ce74595` | `/dashboard/stores/{store_id}/customers/new` | Added Stitch-aligned Arabic RTL route shell. |
| `المالية والمحفظة - متجر هب` | `237be697ef1443e9b91185890783a370` | `/dashboard/stores/{store_id}/finance` | Existing API-backed finance route. |
| `طلب تحويل وسحب الأرباح - متجر هب` | `17f36244d1844164b44ddcd20b367ef2` | `/dashboard/stores/{store_id}/finance/payouts/new` | Added Stitch-aligned Arabic RTL route shell. |
| `مركز الربط والتكامل والـ API - متجر هب` | `33f3feaf951c4457abda24ed0eab0d2c` | `/dashboard/stores/{store_id}/integrations` | Existing API-backed integrations and developer route. |
| `إعدادات المتجر والحساب - متجر هب` | `2f0f555364c2499ca0eb20106644027e` | `/dashboard/stores/{store_id}/settings` | Added Stitch-aligned Arabic RTL route shell. |
| `الملف الشخصي والحساب - متجر هب` | `26eb0d93e46c4dbebc6a0ad23f33a6f1` | `/dashboard/stores/{store_id}/account` | Added Stitch-aligned Arabic RTL route shell from `get_screen` details. |
| `مركز الإشعارات والتنبيهات - متجر هب` | `38895d30b510491fbb8e60981b8e97a6` | `/dashboard/stores/{store_id}/notifications` | Added Stitch-aligned Arabic RTL route shell and topbar notification link. |
| `إدارة المستخدمين وفريق العمل - متجر هب` | `bf9ce524deb64412a64ef9688429837e` | `/dashboard/stores/{store_id}/users` | Added Stitch-aligned Arabic RTL route shell. |
| `الخطة والاشتراك وإدارة الباقات - متجر هب` | `cbb6e6cdd7344c62b023c3644a98bfb6` | `/dashboard/stores/{store_id}/billing` | Added Stitch-aligned Arabic RTL route shell. |
| `الخطة والاشتراك وإدارة الباقات - متجر هب` | `ecee261b51834999ae3a6513047e95d6` | `/dashboard/stores/{store_id}/billing` | Duplicate/prototype billing screen mapped to the same billing destination. |
| `التحليلات والتقارير المتقدمة - متجر هب` | `f211c59b08a6439d8181ed25c5abc541` | `/dashboard/stores/{store_id}/analytics` | Added Stitch-aligned Arabic RTL route shell. |
| `تصميم المتجر والقوالب الجاهزة - متجر هب` | `f44bf2a9fe894e8588b728e68020ed84` | `/dashboard/stores/{store_id}/storefront` | Existing storefront/theme route. |
| `MatjerHub Brand Logo` | `cc2a635b61244038b532a6ced210873f` | Asset, no route | Brand asset, not an app destination. |
| `Professional avatar headshot...` | `cc8331289828447385c2725e039aaa4c` | Asset, no route | Image asset, not an app destination. |

## Implementation Notes

- The new route shells use shared Stitch screen configuration to keep the Arabic RTL layouts, page hierarchy, primary actions, secondary actions, cards, and readiness rails consistent.
- Existing live/API-backed screens were preserved rather than replaced with static mockups.
- Screens that depend on backend modules not yet present in Seller BFF intentionally show UI-ready placeholders (`—`, `Pending API`, or setup states) instead of fabricated production data.
- Sidebar navigation now exposes Stitch-designed child destinations for orders, carts, finance payouts, billing, notifications, and team management.
- Topbar notifications now route to the Notification Center, and account settings routes to the store settings screen.

## Verification Notes

- Desktop screenshot verified at 1440 x 1100.
- Mobile-only drawer controls are hidden on desktop.
- Browser-rendered dashboard showed 4 KPI cards and a visible Attention Center.
- Fake backend does not currently implement `operational-state` and `theme` for the local `store-a` fixture; the dashboard reports those optional sections as unavailable instead of fabricating data.
- `npm test -- --run` passes for the Seller package.
- `npm run build` passes and includes the added store-scoped Stitch routes.
