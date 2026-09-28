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

/**
 * Verification and password-reset codes expire like legacy's (10 minutes).
 * Their length and the password/username rules live in
 * `@notefinder/contracts`, shared with the clients' forms.
 */
export const OTP_EXPIRES_IN_SECONDS = 10 * 60;
