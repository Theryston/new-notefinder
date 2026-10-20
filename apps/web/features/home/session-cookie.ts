/**
 * Whether a cookie name belongs to a notefinder session (Better Auth's
 * `notefinder.session_token`, or `__Secure-` prefixed in production). A
 * visitor carrying one gets the personal path, which is never shared-cached.
 */
const SESSION_COOKIE_NAME = /^(?:__Secure-)?notefinder[.-]/;

export const isSessionCookieName = (name: string): boolean =>
  SESSION_COOKIE_NAME.test(name);
