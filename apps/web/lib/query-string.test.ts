import { describe, expect, it } from 'vitest';

import { queryStringOf } from './query-string';

describe('queryStringOf', () => {
  it('is empty without a query', () => {
    expect(queryStringOf({})).toBe('');
  });

  it('keeps every key, including repeated ones, and skips undefined values', () => {
    expect(queryStringOf({ a: '1', list: ['x', 'y'], unset: undefined })).toBe(
      '?a=1&list=x&list=y',
    );
  });

  it('encodes the values', () => {
    expect(queryStringOf({ q: 'bohemian rhapsody' })).toBe(
      '?q=bohemian+rhapsody',
    );
  });
});
