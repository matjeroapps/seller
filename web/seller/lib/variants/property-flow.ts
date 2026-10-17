import type { ProductAttributeOption } from '@/lib/api/types';

export interface PropertyDraft {
  code: string;
  nameAr: string;
  nameEn: string;
}

export interface PropertyValueDraft extends PropertyDraft {
  attributeId: string;
}

export function activeProperties(properties: ProductAttributeOption[]): ProductAttributeOption[] {
  return properties
    .filter((property) => property.status === 'active')
    .map((property) => ({
      ...property,
      values: property.values.filter((value) => value.status === 'active'),
    }));
}

export function appendPropertyValue(
  properties: ProductAttributeOption[],
  draft: PropertyValueDraft,
): ProductAttributeOption[] {
  const nextValue = {
    id: draft.code,
    code: draft.code,
    name: draft.nameAr || draft.nameEn || draft.code,
    status: 'active',
  };
  return properties.map((property) =>
    property.id === draft.attributeId && !property.values.some((value) => value.code === draft.code)
      ? { ...property, values: [...property.values, nextValue] }
      : property,
  );
}

export function appendProperty(
  properties: ProductAttributeOption[],
  draft: PropertyDraft,
): ProductAttributeOption[] {
  if (properties.some((property) => property.code === draft.code)) return properties;
  return [...properties, {
    id: draft.code,
    code: draft.code,
    name: draft.nameAr || draft.nameEn || draft.code,
    status: 'active',
    values: [],
  }];
}
