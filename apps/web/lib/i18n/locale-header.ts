/**
 * The request header `proxy.ts` uses to hand the URL's locale to the framework
 * fallback (`app/global-not-found.tsx`): on an unmatched URL or a catalog
 * `/_not-found` rewrite there is no `[locale]` segment, so `next/root-params`
 * has nothing to read. `lib/i18n/request.ts` reads it back, validated.
 */
export const localeHeaderName = 'x-notefinder-locale';

/** A copy of `source` with the locale set on it, for a forwarded request. */
export function withLocaleHeader(source: Headers, locale: string): Headers {
  const headers = new Headers(source);
  headers.set(localeHeaderName, locale);
  return headers;
}
