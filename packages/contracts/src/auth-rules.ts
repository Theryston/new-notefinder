/**
 * Auth rules shared by the API and the clients' forms. Kept free of Zod so
 * clients can import them (`@notefinder/contracts/auth-rules`) without
 * shipping the schema library on first load.
 */

/**
 * Shortest password accepted on sign-up and reset (legacy: 6). Sign-in
 * doesn't check it, so no existing password stops working.
 */
export const PASSWORD_MIN_LENGTH = 6;
/** Better Auth's default maximum. */
export const PASSWORD_MAX_LENGTH = 128;

// Legacy username rules: 3-50 characters, letters, digits and underscores.
// The API lowercases the input before storing it, as legacy did.
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/i;

/** Length of the email verification and password-reset codes. */
export const OTP_LENGTH = 6;

/** Whether `value` passes the username rules (without Zod). */
export const isValidUsername = (value: string): boolean =>
  value.length >= USERNAME_MIN_LENGTH &&
  value.length <= USERNAME_MAX_LENGTH &&
  USERNAME_PATTERN.test(value);
