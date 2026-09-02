import { describe, expect, it } from 'vitest';

import { buildQueryString, parseCatalogParams, toCatalogQuery } from '../src/lib/catalog-query';
import { DEFAULT_PAGE_SIZE } from '../src/lib/contracts';

describe('catalog query parsing', () => {
  it('defaults to the first page with no filters', () => {
    expect(parseCatalogParams({})).toEqual({
      page: 1,
      sort: null,
      availability: null,
      keyword: '',
      category: '',
      limit: DEFAULT_PAGE_SIZE
    });
  });

  it('reads supported filter, sort and page values', () => {
    expect(
      parseCatalogParams({ page: '3', sort: 'price_desc', availability: 'in_stock', q: ' lamp ', limit: '48' })
    ).toEqual({
      page: 3,
      sort: 'price_desc',
      availability: 'in_stock',
      keyword: 'lamp',
      category: '',
      limit: 48
    });
  });

  it('drops an unrecognized sort or availability rather than forwarding it', () => {
    const params = parseCatalogParams({ sort: 'cheapest', availability: 'preorder' });

    expect(params.sort).toBeNull();
    expect(params.availability).toBeNull();
  });

  it('ignores a page that is not a positive integer', () => {
    for (const page of ['0', '-2', 'two', '1.5', '', '00000000000000009']) {
      expect(parseCatalogParams({ page }).page).toBe(1);
    }
  });

  it('bounds pagination and page size', () => {
    expect(parseCatalogParams({ page: '999999' }).page).toBe(1_000);
    expect(parseCatalogParams({ limit: '5000' }).limit).toBe(60);
  });

  it('takes the first value when a parameter is repeated', () => {
    expect(parseCatalogParams({ q: ['lamp', 'chair'], sort: ['name_asc', 'newest'] })).toMatchObject({
      keyword: 'lamp',
      sort: 'name_asc'
    });
  });

  it('truncates an oversized keyword instead of rejecting the request', () => {
    expect(parseCatalogParams({ q: 'a'.repeat(400) }).keyword).toHaveLength(128);
  });

  it('translates parsed state into an API query', () => {
    const params = parseCatalogParams({ page: '2', sort: 'name_asc', availability: 'out_of_stock', q: 'lamp' });

    expect(toCatalogQuery(params)).toEqual({
      limit: 24,
      offset: 24,
      sort: 'name_asc',
      availability: 'out_of_stock',
      keyword: 'lamp'
    });
  });

  it('lets a caller pin a category without changing the URL contract', () => {
    expect(toCatalogQuery(parseCatalogParams({}), { category: 'lighting' })).toMatchObject({
      category: 'lighting',
      offset: 0
    });
  });

  it('round-trips listing state through the query string', () => {
    const params = parseCatalogParams({ page: '2', sort: 'price_asc', availability: 'in_stock', q: 'lamp' });

    expect(buildQueryString(params)).toBe('?q=lamp&sort=price_asc&availability=in_stock&page=2');
    expect(parseCatalogParams(Object.fromEntries(new URLSearchParams(buildQueryString(params).slice(1))))).toEqual(
      params
    );
  });

  it('omits defaults from the query string', () => {
    expect(buildQueryString(parseCatalogParams({}))).toBe('');
    expect(buildQueryString(parseCatalogParams({ page: '1' }))).toBe('');
  });

  it('encodes a keyword so it cannot inject another parameter', () => {
    const params = parseCatalogParams({ q: 'lamp&sort=evil#frag' });

    expect(buildQueryString(params)).toBe('?q=lamp%26sort%3Devil%23frag');
  });

  it('applies pagination and filter overrides', () => {
    const params = parseCatalogParams({ page: '2', sort: 'newest' });

    expect(buildQueryString(params, { page: 5 })).toBe('?sort=newest&page=5');
    expect(buildQueryString(params, { sort: null })).toBe('?page=2');
    expect(buildQueryString(params, { q: 'chair' })).toBe('?q=chair&sort=newest&page=2');
  });
});
