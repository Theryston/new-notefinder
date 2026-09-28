import { describe, expect, it } from 'vitest';

import { authErrorCode, authRequest } from './auth-error';

describe('authErrorCode', () => {
  it.each([
    'INVALID_OTP',
    'OTP_EXPIRED',
    'TOO_MANY_ATTEMPTS',
    'USERNAME_IS_ALREADY_TAKEN',
    'PASSWORD_TOO_SHORT',
    'INVALID_EMAIL_OR_PASSWORD',
    'INVALID_USERNAME_OR_PASSWORD',
    'EMAIL_NOT_VERIFIED',
  ])('keeps the known code %s', (code) => {
    expect(authErrorCode({ code, status: 400 })).toBe(code);
  });

  it('prefers a known code over the status', () => {
    expect(authErrorCode({ code: 'INVALID_OTP', status: 429 })).toBe(
      'INVALID_OTP',
    );
  });

  it('maps rate limiting and missing sessions by status', () => {
    expect(authErrorCode({ status: 429 })).toBe('RATE_LIMITED');
    expect(authErrorCode({ code: 'OTHER', status: 401 })).toBe('UNAUTHORIZED');
  });

  it('falls back to UNKNOWN', () => {
    expect(authErrorCode({ code: 'FAILED_TO_CREATE_USER', status: 500 })).toBe(
      'UNKNOWN',
    );
    expect(authErrorCode({})).toBe('UNKNOWN');
  });
});

describe('authRequest', () => {
  it('passes the result through', async () => {
    await expect(
      authRequest(async () => ({ data: 1, error: null })),
    ).resolves.toEqual({ data: 1, error: null });
    await expect(
      authRequest(async () => ({ data: null, error: { status: 429 } })),
    ).resolves.toEqual({ data: null, error: { status: 429 } });
  });

  it('turns a thrown failure into an unknown error', async () => {
    const result = await authRequest(() =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    expect(result).toEqual({ data: null, error: {} });
    expect(result.error && authErrorCode(result.error)).toBe('UNKNOWN');
  });
});
