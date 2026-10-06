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

  it('keeps lyrics scope from the search page', () => {
    expect(searchHref('queen', 'lyrics')).toEqual({
      pathname: '/search',
      query: { q: 'queen', scope: 'lyrics' },
    });
  });

  it('omits the default metadata scope', () => {
    expect(searchHref('queen', 'metadata')).toEqual({
      pathname: '/search',
      query: { q: 'queen' },
    });
    expect(searchHref('queen', null)).toEqual({
      pathname: '/search',
      query: { q: 'queen' },
    });
    expect(searchHref('queen', undefined)).toEqual({
      pathname: '/search',
      query: { q: 'queen' },
    });
  });

  it('returns null for a blank query even with a scope', () => {
    expect(searchHref('   ', 'lyrics')).toBeNull();
  });
});
