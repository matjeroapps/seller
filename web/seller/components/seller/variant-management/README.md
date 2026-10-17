# Product variant management

The Stitch reference is screen `c874e33b867141b59cbfc9a60d6ec2e9` in project
`10181626586509106537`, titled **إضافة منتج جديد - دايالوج إدارة وتعديل الخصائص**.

## Stable anchors

- `variant-attribute-picker`: select active reusable properties and values.
- `variant-preview-errors`: validation and authorization errors.
- `variant-preview-table`: deterministic combination preview and outcomes.
- `product-variant-list`: current variants on add/edit/detail product contexts.

## Required states

| State | Expected behavior |
| --- | --- |
| Empty | Explain that properties and values must be selected before generating. |
| Loading | Lock controls and keep the dialog mounted. |
| Validation | Keep entered values and show an actionable Arabic/English message. |
| Existing | Show the combination as already present and do not create it again. |
| Failed | Keep the row retryable without duplicating successful rows. |
| Removed | Hide it from the current catalog while retaining operational history. |
| Narrow RTL | Dialog scrolls internally; actions remain reachable and labels are localized. |
