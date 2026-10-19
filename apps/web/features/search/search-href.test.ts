import { describe, expect, it } from 'vitest';

import { searchHref } from './search-href';

describe('searchHref', () => {
  it('links to /search with the query', () => {
    expect(searchHref('queen')).toEqual({
      pathname: '/search',
      query: { q: 'queen' },
    });
  });

  it('trims and collapses whitespace', () => {
    expect(searchHref('  bohemian \t  rhapsody ')).toEqual({
      pathname: '/search',
      query: { q: 'bohemian rhapsody' },
    });
  });

  it('returns null for a blank query', () => {
    expect(searchHref('')).toBeNull();
    expect(searchHref('   ')).toBeNull();
  });
});
