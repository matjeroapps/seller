export interface VariantPreviewValue {
  id: string;
  code: string;
  name: string;
  status?: string;
}

export interface VariantPreviewAttribute {
  id: string;
  code: string;
  name: string;
  values: VariantPreviewValue[];
}

export interface VariantPreviewDimensionInput {
  attribute_id: string;
  value_ids: string[];
}

export interface VariantPreviewItem {
  client_item_id: string;
  signature: string;
  attribute_values: Array<{
    attribute_id: string;
    attribute_value_id: string;
  }>;
  labels: Array<{
    attribute_name: string;
    value_name: string;
  }>;
  variant_code: string;
  sku_code: string;
  existing: boolean;
  removed: boolean;
}

export interface BuildVariantPreviewInput {
  productCode: string;
  attributes: VariantPreviewAttribute[];
  dimensions: VariantPreviewDimensionInput[];
  existingSignatures?: Set<string>;
  existingVariantCodes?: Set<string>;
  existingSkuCodes?: Set<string>;
  maxCombinations?: number;
}

export interface VariantPreviewResult {
  combination_count: number;
  items: VariantPreviewItem[];
  errors: string[];
}

interface ResolvedDimension {
  attribute: VariantPreviewAttribute;
  values: VariantPreviewValue[];
}

export function canonicalSignature(values: Array<{ attribute_id: string; attribute_value_id: string }>): string {
  return [...values]
    .sort((a, b) => compareText(a.attribute_id, b.attribute_id) || compareText(a.attribute_value_id, b.attribute_value_id))
    .map((value) => `${value.attribute_id}=${value.attribute_value_id}`)
    .join('|');
}

interface VariantAttributeSourceValue {
  attribute_id: string;
  attribute_name?: string;
  attribute_code?: string;
  value_id: string;
  value_name?: string;
  value_code?: string;
}

/**
 * Derives the attribute/value picker options from data already present on the
 * product detail (existing variants' attribute values). No attributes are
 * returned when the product has no configured variants yet.
 */
export function deriveVariantAttributes(
  sources: Array<{ attribute_values?: VariantAttributeSourceValue[] } | null | undefined>
): VariantPreviewAttribute[] {
  const attributeMap = new Map<string, VariantPreviewAttribute>();
  for (const source of sources ?? []) {
    for (const value of source?.attribute_values ?? []) {
      if (!value?.attribute_id || !value?.value_id) continue;
      let attribute = attributeMap.get(value.attribute_id);
      if (!attribute) {
        attribute = {
          id: value.attribute_id,
          code: value.attribute_code || value.attribute_id,
          name: value.attribute_name || value.attribute_code || value.attribute_id,
          values: []
        };
        attributeMap.set(value.attribute_id, attribute);
      }
      if (!attribute.values.some((existing) => existing.id === value.value_id)) {
        attribute.values.push({
          id: value.value_id,
          code: value.value_code || value.value_id,
          name: value.value_name || value.value_code || value.value_id
        });
      }
    }
  }
  return [...attributeMap.values()].sort(
    (a, b) => compareText(a.name, b.name) || compareText(a.code, b.code) || compareText(a.id, b.id)
  );
}

export function buildVariantPreview(input: BuildVariantPreviewInput): VariantPreviewResult {
  const maxCombinations = input.maxCombinations ?? 100;
  const errors: string[] = [];
  const attributeByID = new Map(input.attributes.map((attribute) => [attribute.id, attribute]));
  const seenAttributeIDs = new Set<string>();
  const dimensions: ResolvedDimension[] = [];
  let combinationCount = input.dimensions.length > 0 ? 1 : 0;

  for (const dimension of input.dimensions) {
    const attribute = attributeByID.get(dimension.attribute_id);
    const attributeName = attribute?.name || dimension.attribute_id;

    if (!attribute) {
      errors.push(`Selected attribute ${dimension.attribute_id} is no longer available.`);
      continue;
    }
    if (seenAttributeIDs.has(attribute.id)) {
      errors.push(`Duplicate attribute dimension: ${attribute.name || attribute.code}`);
      continue;
    }
    seenAttributeIDs.add(attribute.id);

    if (dimension.value_ids.length === 0) {
      errors.push(`Select at least one value for ${attribute.name || attribute.code}.`);
      continue;
    }

    const valueByID = new Map(attribute.values.map((value) => [value.id, value]));
    const resolvedValues: VariantPreviewValue[] = [];
    const seenValueIDs = new Set<string>();
    for (const valueID of dimension.value_ids) {
      if (seenValueIDs.has(valueID)) continue;
      seenValueIDs.add(valueID);
      const value = valueByID.get(valueID);
      if (!value || (value.status && value.status !== 'active')) {
        errors.push(`Selected value ${valueID} is no longer available for ${attributeName}.`);
        continue;
      }
      resolvedValues.push(value);
    }

    if (resolvedValues.length > 0) {
      resolvedValues.sort(compareValues);
      dimensions.push({ attribute, values: resolvedValues });
      combinationCount *= resolvedValues.length;
    }
  }

  dimensions.sort((a, b) => compareText(a.attribute.code, b.attribute.code) || compareText(a.attribute.id, b.attribute.id));

  if (combinationCount > maxCombinations) {
    errors.push(`Selection creates ${combinationCount} combinations. Reduce selected values or dimensions and try again.`);
  }

  if (errors.length > 0 || dimensions.length === 0) {
    return { combination_count: combinationCount, items: [], errors };
  }

  const usedVariantCodes = new Set(input.existingVariantCodes ?? []);
  const usedSkuCodes = new Set(input.existingSkuCodes ?? []);
  const existingSignatures = input.existingSignatures ?? new Set<string>();
  const productCode = slugCode(input.productCode || 'variant');
  const items: VariantPreviewItem[] = [];

  for (const combination of cartesian(dimensions)) {
    const attributeValues = combination.map(({ attribute, value }) => ({
      attribute_id: attribute.id,
      attribute_value_id: value.id,
    }));
    const signature = canonicalSignature(attributeValues);
    const suffix = combination.map(({ value }) => slugCode(value.code || value.name || value.id)).join('-');
    const baseVariantCode = `${productCode}-${suffix}`.toUpperCase();
    const baseSkuCode = `SKU-${baseVariantCode}`;

    const existing = existingSignatures.has(signature);
    const variantCode = existing ? baseVariantCode : nextAvailableCode(baseVariantCode, usedVariantCodes);
    const skuCode = existing ? baseSkuCode : nextAvailableCode(baseSkuCode, usedSkuCodes);
    if (!existing) {
      usedVariantCodes.add(variantCode);
      usedSkuCodes.add(skuCode);
    }

    items.push({
      client_item_id: attributeValues
        .map((value) => `${value.attribute_id}-${value.attribute_value_id}`)
        .join('__'),
      signature,
      attribute_values: attributeValues,
      labels: combination.map(({ attribute, value }) => ({
        attribute_name: attribute.name || attribute.code,
        value_name: value.name || value.code,
      })),
      variant_code: variantCode,
      sku_code: skuCode,
      existing,
      removed: false,
    });
  }

  return { combination_count: items.length, items, errors: [] };
}

function cartesian(dimensions: ResolvedDimension[]): Array<Array<{ attribute: VariantPreviewAttribute; value: VariantPreviewValue }>> {
  return dimensions.reduce<Array<Array<{ attribute: VariantPreviewAttribute; value: VariantPreviewValue }>>>(
    (rows, dimension) =>
      rows.flatMap((row) =>
        dimension.values.map((value) => [...row, { attribute: dimension.attribute, value }])
      ),
    [[]]
  );
}

function nextAvailableCode(baseCode: string, usedCodes: Set<string>): string {
  if (!usedCodes.has(baseCode)) return baseCode;
  let index = 2;
  while (usedCodes.has(`${baseCode}-${index}`)) {
    index += 1;
  }
  return `${baseCode}-${index}`;
}

function slugCode(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function compareValues(a: VariantPreviewValue, b: VariantPreviewValue): number {
  return compareText(a.code, b.code) || compareText(a.id, b.id);
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}
