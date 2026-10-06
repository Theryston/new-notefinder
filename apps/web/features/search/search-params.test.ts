import { describe, expect, it } from 'vitest';

import {
  isSearchableQuery,
  normalizeSearchQuery,
  parseSearchScope,
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
  it(`needs at least ${SEARCH_MIN_QUERY_LENGTH} non-blank characters`, () => {
    expect(isSearchableQuery('q')).toBe(false);
    expect(isSearchableQuery('  q  ')).toBe(false);
    expect(isSearchableQuery('queen')).toBe(true);
    expect(isSearchableQuery('  ab  ')).toBe(true);
    expect(isSearchableQuery('')).toBe(false);
    expect(isSearchableQuery('   ')).toBe(false);
  });
});

describe('parseSearchScope', () => {
  it('defaults a missing scope to metadata', () => {
    expect(parseSearchScope(null)).toBe('metadata');
    expect(parseSearchScope(undefined)).toBe('metadata');
    expect(parseSearchScope('')).toBe('metadata');
  });

  it('keeps the catalog vocabulary', () => {
    expect(parseSearchScope('metadata')).toBe('metadata');
    expect(parseSearchScope('lyrics')).toBe('lyrics');
  });

  it('falls back to metadata for an unknown scope', () => {
    expect(parseSearchScope('artists')).toBe('metadata');
    expect(parseSearchScope(42)).toBe('metadata');
  });
});

describe('search timing', () => {
  it('debounces URL updates by 230ms', () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(230);
  });
});
