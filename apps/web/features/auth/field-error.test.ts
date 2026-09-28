import { describe, expect, it } from 'vitest';

import { fieldErrorKey } from './field-error';

describe('fieldErrorKey', () => {
  it.each([
    ['name', 'too_small', 'name.errors.required'],
    ['name', 'invalid_type', 'name.errors.invalid'],
    ['email', 'invalid_format', 'email.errors.invalid'],
    ['password', 'too_small', 'password.errors.tooShort'],
    ['password', 'too_big', 'password.errors.tooLong'],
    ['username', 'too_small', 'username.errors.tooShort'],
    ['username', 'too_big', 'username.errors.tooLong'],
    ['username', 'invalid_format', 'username.errors.invalid'],
  ] as const)('%s + %s → %s', (field, type, key) => {
    expect(fieldErrorKey(field, type)).toBe(key);
  });

  it('uses the generic message without a type', () => {
    expect(fieldErrorKey('password', undefined)).toBe(
      'password.errors.invalid',
    );
  });
});
