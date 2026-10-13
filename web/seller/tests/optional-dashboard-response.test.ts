import { describe, expect, it } from 'vitest';
import { isOptionalStoreReadNotFound } from '../lib/api/optional-dashboard-response';

describe('optional dashboard API resources', () => {
  it.each([
    [['v1', 'seller', 'stores', 'store-1', 'theme']],
    [['v1', 'seller', 'stores', 'store-1', 'finance', 'balance']],
  ])('normalizes missing optional GET resource %j', (path) => {
    expect(isOptionalStoreReadNotFound('GET', path, 404)).toBe(true);
  });

  it.each([
    ['POST', ['v1', 'seller', 'stores', 'store-1', 'theme'], 404],
    ['GET', ['v1', 'seller', 'stores', 'store-1', 'products'], 404],
    ['GET', ['v1', 'seller', 'stores', 'store-1', 'finance', 'balance'], 401],
    ['GET', ['v1', 'seller', 'stores', 'store-1', 'theme', 'draft'], 404],
  ])('keeps non-optional errors unchanged for %s %j (%s)', (method, path, status) => {
    expect(isOptionalStoreReadNotFound(method, path, status)).toBe(false);
  });
});
