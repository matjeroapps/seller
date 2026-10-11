import { describe, expect, it } from 'vitest';
import { buildVariantPreview } from '../lib/variants/preview';

const attributes = [
  {
    id: 'attr_size',
    code: 'size',
    name: 'Size',
    values: [
      { id: 'val_m', code: 'm', name: 'Medium', status: 'active' },
      { id: 'val_s', code: 's', name: 'Small', status: 'active' },
      { id: 'val_l', code: 'l', name: 'Large', status: 'active' },
    ],
  },
  {
    id: 'attr_color',
    code: 'color',
    name: 'Color',
    values: [
      { id: 'val_blue', code: 'blue', name: 'Blue', status: 'active' },
      { id: 'val_red', code: 'red', name: 'Red', status: 'active' },
    ],
  },
];

describe('buildVariantPreview', () => {
  it('creates six stable ordered combinations with readable editable suggestions', () => {
    const result = buildVariantPreview({
      productCode: 'shirt',
      attributes,
      dimensions: [
        { attribute_id: 'attr_color', value_ids: ['val_red', 'val_blue'] },
        { attribute_id: 'attr_size', value_ids: ['val_s', 'val_m', 'val_l'] },
      ],
      existingSignatures: new Set(['attr_color=val_red|attr_size=val_s']),
      existingVariantCodes: new Set(['SHIRT-RED-M']),
      existingSkuCodes: new Set(['SKU-SHIRT-BLUE-L']),
    });

    expect(result.combination_count).toBe(6);
    expect(result.errors).toEqual([]);
    expect(result.items.map((item) => item.client_item_id)).toEqual([
      'attr_color-val_blue__attr_size-val_l',
      'attr_color-val_blue__attr_size-val_m',
      'attr_color-val_blue__attr_size-val_s',
      'attr_color-val_red__attr_size-val_l',
      'attr_color-val_red__attr_size-val_m',
      'attr_color-val_red__attr_size-val_s',
    ]);
    expect(result.items[5]).toMatchObject({
      existing: true,
      variant_code: 'SHIRT-RED-S',
      sku_code: 'SKU-SHIRT-RED-S',
    });
    expect(result.items[4].variant_code).toBe('SHIRT-RED-M-2');
    expect(result.items[0].sku_code).toBe('SKU-SHIRT-BLUE-L-2');
  });

  it('rejects duplicate dimensions, empty selections, stale values, and over-100 combinations', () => {
    expect(
      buildVariantPreview({
        productCode: 'shirt',
        attributes,
        dimensions: [
          { attribute_id: 'attr_color', value_ids: ['val_red'] },
          { attribute_id: 'attr_color', value_ids: ['val_blue'] },
        ],
      }).errors
    ).toContain('Duplicate attribute dimension: Color');

    expect(
      buildVariantPreview({
        productCode: 'shirt',
        attributes,
        dimensions: [{ attribute_id: 'attr_color', value_ids: [] }],
      }).errors
    ).toContain('Select at least one value for Color.');

    expect(
      buildVariantPreview({
        productCode: 'shirt',
        attributes,
        dimensions: [{ attribute_id: 'attr_color', value_ids: ['val_missing'] }],
      }).errors
    ).toContain('Selected value val_missing is no longer available for Color.');

    const manyValues = Array.from({ length: 101 }, (_, index) => ({
      id: `val_${index}`,
      code: `v${index}`,
      name: `Value ${index}`,
      status: 'active',
    }));
    expect(
      buildVariantPreview({
        productCode: 'shirt',
        attributes: [{ id: 'attr_many', code: 'many', name: 'Many', values: manyValues }],
        dimensions: [{ attribute_id: 'attr_many', value_ids: manyValues.map((value) => value.id) }],
      }).errors
    ).toContain('Selection creates 101 combinations. Reduce selected values or dimensions and try again.');
  });
});

import { deriveVariantAttributes } from '../lib/variants/preview';

describe('deriveVariantAttributes', () => {
  it('derives attribute picker options from existing product-variant attribute values', () => {
    const derived = deriveVariantAttributes([
      {
        attribute_values: [
          { attribute_id: 'attr_color', attribute_name: 'Color', attribute_code: 'color', value_id: 'val_red', value_name: 'Red', value_code: 'red' },
          { attribute_id: 'attr_color', attribute_name: 'Color', attribute_code: 'color', value_id: 'val_blue', value_name: 'Blue', value_code: 'blue' },
        ],
      },
      {
        attribute_values: [
          { attribute_id: 'attr_color', value_id: 'val_red' },
          { attribute_id: 'attr_size', attribute_name: 'Size', value_id: 'val_m', value_name: 'Medium' },
        ],
      },
    ]);

    expect(derived.map((attribute) => attribute.id)).toEqual(['attr_color', 'attr_size']);
    expect(derived[0].values.map((value) => value.id)).toEqual(['val_red', 'val_blue']);
    expect(derived[1].values[0]).toMatchObject({ id: 'val_m', name: 'Medium', code: 'val_m' });
  });

  it('returns no attributes for a product without configured variants and feeds the preview builder', () => {
    expect(deriveVariantAttributes([null, {}, { attribute_values: [] }])).toEqual([]);

    const derived = deriveVariantAttributes([
      {
        attribute_values: [
          { attribute_id: 'attr_color', attribute_name: 'Color', value_id: 'val_red', value_name: 'Red' },
        ],
      },
    ]);
    const preview = buildVariantPreview({
      productCode: 'shirt',
      attributes: derived,
      dimensions: [{ attribute_id: 'attr_color', value_ids: ['val_red'] }],
    });
    expect(preview.items).toHaveLength(1);
    expect(preview.items[0].labels).toEqual([{ attribute_name: 'Color', value_name: 'Red' }]);
  });
});
