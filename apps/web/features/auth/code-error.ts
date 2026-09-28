import type { AuthErrorCode } from './auth-error';

const CODE_ERRORS: ReadonlySet<AuthErrorCode> = new Set([
  'INVALID_OTP',
  'OTP_EXPIRED',
  'TOO_MANY_ATTEMPTS',
]);

/**
 * Whether an auth error is about the emailed code itself, so the form
 * clears it for a new one. Other errors (rate limit, network) keep what the
 * user typed for a retry.
 */
export const isCodeError = (code: AuthErrorCode): boolean =>
  CODE_ERRORS.has(code);
