import { describe, expect, it } from 'vitest';

import { searchKeys } from './query-keys';

describe('searchKeys.infiniteResults', () => {
  it('keys pages by query text plus scope with defaults applied', () => {
    expect(searchKeys.infiniteResults({ query: 'queen' })).toEqual([
      'search',
      'infinite',
      { query: 'queen', scope: 'metadata', limit: 20 },
    ]);
  });

  it('keys a lyrics query apart from a metadata one', () => {
    expect(searchKeys.infiniteResults({ query: 'queen' })).not.toEqual(
      searchKeys.infiniteResults({ query: 'queen', scope: 'lyrics' }),
    );
  });

  it('shares one key across offsets', () => {
    expect(searchKeys.infiniteResults({ query: 'queen', offset: 40 })).toEqual(
      searchKeys.infiniteResults({ query: 'queen', offset: 0 }),
    );
  });

  it('rejects a blank query', () => {
    expect(() => searchKeys.infiniteResults({ query: '   ' })).toThrow();
  });
});
