/**
 * Whether a cookie name belongs to a notefinder session. The API's Better Auth
 * sets `notefinder.session_token` (`__Secure-` prefixed in production). A
 * visitor carrying one gets the personal path, which is never shared-cached.
 */
const SESSION_COOKIE_NAME = /^(?:__Secure-)?notefinder\./;

export const isSessionCookieName = (name: string): boolean =>
  SESSION_COOKIE_NAME.test(name);

/**
 * Whether the request carries a session: the visitor gets the personal path.
 * Shared by the feed and its loading fallback, so a signed-in visitor never
 * sees the public skeleton (nor the public feed) flash before their own rows.
 */
export const hasSessionCookie = (names: readonly string[]): boolean =>
  names.some(isSessionCookieName);
