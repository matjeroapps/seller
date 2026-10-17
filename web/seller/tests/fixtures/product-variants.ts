export const productVariantFixtures = {
  attributes: [
    {
      id: 'attribute-color',
      code: 'color',
      name: 'اللون / Color',
      status: 'active',
      values: [
        { id: 'value-red', code: 'red', name: 'أحمر / Red', status: 'active' },
        { id: 'value-blue', code: 'blue', name: 'أزرق / Blue', status: 'active' },
      ],
    },
    {
      id: 'attribute-size',
      code: 'size',
      name: 'المقاس / Size',
      status: 'active',
      values: [
        { id: 'value-small', code: 's', name: 'صغير / Small', status: 'active' },
        { id: 'value-large', code: 'l', name: 'كبير / Large', status: 'active' },
      ],
    },
  ],
  currentVariant: {
    id: 'variant-red-small',
    product_id: 'product-shirt',
    code: 'SHIRT-RED-S',
    status: 'active' as const,
    attribute_values: [
      { id: 'mapping-red', attribute_id: 'attribute-color', attribute_name: 'اللون', attribute_code: 'color', value_id: 'value-red', value_name: 'أحمر', value_code: 'red' },
      { id: 'mapping-small', attribute_id: 'attribute-size', attribute_name: 'المقاس', attribute_code: 'size', value_id: 'value-small', value_name: 'صغير', value_code: 's' },
    ],
    sku: { id: 'sku-red-small', variant_id: 'variant-red-small', code: 'SKU-RED-S', status: 'active' as const, created_at: '', updated_at: '' },
    created_at: '',
    updated_at: '',
  },
  referencedVariant: { id: 'variant-referenced', code: 'SHIRT-BLUE-L', status: 'active' as const },
  removedVariant: { id: 'variant-removed', code: 'SHIRT-OLD', status: 'active' as const },
};
