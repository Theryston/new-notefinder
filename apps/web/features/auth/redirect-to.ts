import { routing } from '@/lib/i18n/routing';

export const DEFAULT_REDIRECT = '/';

// Any origin works: it only lets `URL` resolve the path, and a value that
// resolves elsewhere (`//evil.com`, `https://…`) is rejected by comparing it.
const BASE = 'http://notefinder.invalid';

function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split('/');
  if (!routing.locales.some((locale) => locale === first)) return pathname;
  return `/${rest.join('/')}`;
}

/**
 * The `redirectTo` query param as a same-origin path without the locale
 * prefix (the locale-aware router adds the current one), or `/` when it is
 * missing or points anywhere else (no open redirects).
 */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_REDIRECT;
  }
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return DEFAULT_REDIRECT;
  }
  if (url.origin !== BASE) return DEFAULT_REDIRECT;
  return `${stripLocale(url.pathname)}${url.search}${url.hash}`;
}

/** `redirectTo` from a query string (e.g. `location.search`), sanitized. */
export function redirectToFromSearch(search: string): string {
  return safeRedirectPath(new URLSearchParams(search).get('redirectTo'));
}

type AuthPath = '/sign-up' | '/sign-in' | '/verify-email' | '/setup-username';

export type AuthHref = {
  pathname: AuthPath;
  query: Record<string, string>;
};

/**
 * Link to an auth step that carries `redirectTo` along (left out when it is
 * the default, so URLs stay clean).
 */
export function authHref(
  pathname: AuthPath,
  redirectTo: string,
  query: Record<string, string> = {},
): AuthHref {
  return {
    pathname,
    query: redirectTo === DEFAULT_REDIRECT ? query : { ...query, redirectTo },
  };
}

/** `href` as a path with its query string. */
export function hrefToPath(href: AuthHref): string {
  const query = new URLSearchParams(href.query).toString();
  return query ? `${href.pathname}?${query}` : href.pathname;
}

/**
 * Absolute web URL for `path` in `locale`, for flows that leave the app
 * (Google sign-in comes back to it).
 */
export function absoluteAppUrl(
  origin: string,
  locale: string,
  path: string,
): string {
  const suffix = path === DEFAULT_REDIRECT ? '' : path;
  return `${origin}/${locale}${suffix}`;
}
