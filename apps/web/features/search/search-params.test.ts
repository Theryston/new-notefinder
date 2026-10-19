import { describe, expect, it } from 'vitest';

import {
  isSearchableQuery,
  normalizeSearchQuery,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_QUERY_LENGTH,
} from './search-params';

describe('normalizeSearchQuery', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSearchQuery('  bohemian \t  rhapsody ')).toBe(
      'bohemian rhapsody',
    );
  });

  it('is blank for blank input', () => {
    expect(normalizeSearchQuery('')).toBe('');
    expect(normalizeSearchQuery('   ')).toBe('');
    expect(normalizeSearchQuery(null)).toBe('');
    expect(normalizeSearchQuery(undefined)).toBe('');
  });
});

describe('isSearchableQuery', () => {
  it(`needs at least ${SEARCH_MIN_QUERY_LENGTH} non-blank character`, () => {
    expect(isSearchableQuery('q')).toBe(true);
    expect(isSearchableQuery('  q  ')).toBe(true);
    expect(isSearchableQuery('queen')).toBe(true);
    expect(isSearchableQuery('')).toBe(false);
    expect(isSearchableQuery('   ')).toBe(false);
  });
});

describe('search timing', () => {
  it('debounces URL updates by 230ms', () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(230);
  });
});
