import { isSchemaMismatchError } from './schema-mismatch.js';

describe('isSchemaMismatchError', () => {
  it.each([
    'mbslave sync failed (exit 1): Mismatched schema sequence 31, expected 32',
    'mbslave sync failed (exit 1): schema mismatch, reimport the database',
    'wrong schema version for this mbslave release',
  ])('detects the yearly schema change in %p', (message) => {
    expect(isSchemaMismatchError(new Error(message))).toBe(true);
  });

  it.each([
    'mbslave sync failed (exit 1): boom',
    'HTTP 403: invalid token',
    'connect ECONNREFUSED 127.0.0.1:5432',
  ])('leaves any other failure alone: %p', (message) => {
    expect(isSchemaMismatchError(new Error(message))).toBe(false);
  });

  it('never matches a non-error', () => {
    expect(isSchemaMismatchError('Mismatched schema')).toBe(false);
    expect(isSchemaMismatchError(undefined)).toBe(false);
  });
});
