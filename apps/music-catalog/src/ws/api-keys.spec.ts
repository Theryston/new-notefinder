import { createApiKeyVerifier } from './api-keys.js';

const KEY_A = 'key-a-'.padEnd(32, 'a');
const KEY_B = 'key-b-'.padEnd(40, 'b');

describe('createApiKeyVerifier', () => {
  const isAuthorized = createApiKeyVerifier([KEY_A, KEY_B]);

  it.each([
    ['the first key', `Bearer ${KEY_A}`],
    ['the second key, so keys can be rotated', `Bearer ${KEY_B}`],
    ['a lowercase scheme', `bearer ${KEY_A}`],
    ['extra spaces around the key', `Bearer   ${KEY_A}  `],
  ])('accepts %s', (_label, header) => {
    expect(isAuthorized(header)).toBe(true);
  });

  it.each([
    ['a missing header', undefined],
    ['an empty header', ''],
    ['a scheme without a key', 'Bearer'],
    ['a scheme with a blank key', 'Bearer   '],
    ['a wrong key', `Bearer ${'x'.repeat(32)}`],
    [
      'a key that differs in the last character',
      `Bearer ${KEY_A.slice(0, -1)}b`,
    ],
    ['a prefix of a key', `Bearer ${KEY_A.slice(0, 16)}`],
    ['a key with more characters', `Bearer ${KEY_A}extra`],
    ['the key without the scheme', KEY_A],
    ['another scheme', `Basic ${KEY_A}`],
    ['two keys at once', `Bearer ${KEY_A},${KEY_B}`],
    ['a key in another case', `Bearer ${KEY_A.toUpperCase()}`],
    ['a valid key followed by more words', `Bearer ${KEY_A} extra`],
    ['a valid key after another word', `Token Bearer ${KEY_A}`],
  ])('rejects %s', (_label, header) => {
    expect(isAuthorized(header)).toBe(false);
  });

  it('rejects everything when no key is configured', () => {
    expect(createApiKeyVerifier([])(`Bearer ${KEY_A}`)).toBe(false);
    expect(createApiKeyVerifier([])('Bearer ')).toBe(false);
  });
});
