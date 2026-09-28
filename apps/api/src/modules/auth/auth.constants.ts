/** Injection token for the Better Auth instance: `@Inject(AUTH) auth: Auth`. */
export const AUTH = Symbol('AUTH');

/** Where Better Auth's handler is mounted (outside Nest's router). */
export const AUTH_BASE_PATH = '/v1/auth';

/**
 * Header the API sets (overwriting anything the client sent) to the client IP
 * Express resolved with `TRUST_PROXY`, so Better Auth's rate limiter and
 * session records use the same address as the rest of the API.
 */
export const CLIENT_IP_HEADER = 'x-notefinder-client-ip';

/** Verification and password-reset codes (legacy: 6 digits, 10 minutes). */
export const OTP_LENGTH = 6;
export const OTP_EXPIRES_IN_SECONDS = 10 * 60;

/**
 * Shortest password accepted on sign-up and reset (legacy: 6). Sign-in
 * doesn't check it, so no existing password stops working.
 */
export const PASSWORD_MIN_LENGTH = 6;
