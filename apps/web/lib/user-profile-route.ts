import { type EntityRouteVerdict, verdictForPath } from './entity-route';
import type { Locale } from './i18n/routing';
import { isLocale } from './i18n/routing';

/**
 * `/<locale>/users/<username>` rules for the proxy. A mixed-case username is
 * a permanent redirect (308) to its lowercase form, and an unknown one is a
 * real 404: both are decided before the page streams, for the same reason as
 * the catalog routes (see `entity-route.ts`).
 */

export type UserProfileRoute = {
  locale: Locale;
  username: string;
};

/** `/<locale>/users/<username>`, or undefined for anything else. */
export function parseUserProfileRoute(
  pathname: string,
): UserProfileRoute | undefined {
  const match = /^\/([^/]+)\/users\/([^/]+)\/?$/.exec(pathname);
  if (!match) return undefined;
  const [, locale, rawUsername] = match;
  if (!isLocale(locale) || !rawUsername) return undefined;
  try {
    return { locale, username: decodeURIComponent(rawUsername) };
  } catch {
    return undefined;
  }
}

/** Usernames are stored lowercase, so any other casing is redirected. */
export function needsLowercaseRedirect(username: string): boolean {
  return username !== username.toLowerCase();
}

/** The same URL (query kept) with the username lowercased. */
export function userProfileRedirectUrl(
  requestHref: string,
  username: string,
): URL {
  const url = new URL(requestHref);
  url.pathname = url.pathname.replace(
    /\/users\/[^/]*\/?$/,
    `/users/${encodeURIComponent(username.toLowerCase())}`,
  );
  return url;
}

/** Asks the API for the Profile; only a 404 decides anything (see `entity-route.ts`). */
export function fetchUserProfileVerdict(
  apiUrl: string,
  username: string,
  fetchFn?: Parameters<typeof verdictForPath>[2],
): Promise<EntityRouteVerdict> {
  return verdictForPath(
    apiUrl,
    `users/${encodeURIComponent(username)}`,
    fetchFn ?? fetch,
  );
}
