import { describe, expect, it } from 'vitest';
import { activeProperties, appendProperty, appendPropertyValue } from '../lib/variants/property-flow';

const properties = [{
  id: 'color', code: 'color', name: 'Color', status: 'active',
  values: [{ id: 'red', code: 'red', name: 'Red', status: 'active' }, { id: 'old', code: 'old', name: 'Old', status: 'inactive' }],
}];

describe('property selection flow', () => {
  it('keeps only active reusable properties and values', () => {
    expect(activeProperties(properties)[0].values.map((value) => value.id)).toEqual(['red']);
  });

  it('creates a missing property and immediately appends its value', () => {
    const withProperty = appendProperty([], { code: 'size', nameAr: 'المقاس', nameEn: 'Size' });
    const withValue = appendPropertyValue(withProperty, { attributeId: 'size', code: 'large', nameAr: 'كبير', nameEn: 'Large' });
    expect(withValue).toMatchObject([{ id: 'size', values: [{ id: 'large', name: 'كبير' }] }]);
  });
});
