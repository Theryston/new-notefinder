import { describe, expect, it } from 'vitest';

import { searchKeys } from './query-keys';

describe('searchKeys', () => {
  it('scopes every key under search', () => {
    expect(searchKeys.all).toEqual(['search']);
  });

  it('keys results by the parsed query, with defaults applied', () => {
    expect(searchKeys.results({ query: 'queen' })).toEqual([
      'search',
      { query: 'queen', limit: 20, offset: 0 },
    ]);
  });

  it('rejects a blank query', () => {
    expect(() => searchKeys.results({ query: '   ' })).toThrow();
  });
});
