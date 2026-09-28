import { describe, expect, it } from 'vitest';

import { isCodeError } from './code-error';

describe('isCodeError', () => {
  it.each(['INVALID_OTP', 'OTP_EXPIRED', 'TOO_MANY_ATTEMPTS'] as const)(
    '%s is about the code',
    (code) => {
      expect(isCodeError(code)).toBe(true);
    },
  );

  it.each(['RATE_LIMITED', 'PASSWORD_TOO_SHORT', 'UNKNOWN'] as const)(
    '%s is not about the code',
    (code) => {
      expect(isCodeError(code)).toBe(false);
    },
  );
});
