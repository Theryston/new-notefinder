import { describe, expect, it } from 'vitest';

import { passwordStrength } from './password-strength';

describe('passwordStrength', () => {
  it.each([
    ['', 0],
    ['12345', 0],
    ['123456', 1],
    ['abcdef12', 1],
    ['Abcdef12', 2],
    ['abcdefghijkl', 2],
    ['Abcdefghij1!', 3],
    ['abcdefghij1!', 3],
    ['abcdefghijk1', 2],
  ] as const)('%j → %i', (password, strength) => {
    expect(passwordStrength(password)).toBe(strength);
  });
});
