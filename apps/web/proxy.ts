import { type NextRequest, NextResponse } from 'next/server';

import { detectLocale } from '@/lib/i18n/detect-locale';
import { isLocale, localeCookieName } from '@/lib/i18n/routing';

/**
 * Redirects every path without a locale prefix (including legacy URLs like
 * `/tracks/abc?x=1`) to the visitor's locale, keeping path and query.
 *
 * next-intl's middleware is deliberately not used: it has no country-based
 * detection, and on prefixed paths it may set the locale cookie, which would
 * make otherwise static pages uncacheable by the CDN and overwrite the
 * user's explicit choice with whatever link they last followed.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split('/')[1];

  // A URL that already has a locale is always respected.
  if (isLocale(firstSegment)) return NextResponse.next();

  const locale = detectLocale({
    cookie: request.cookies.get(localeCookieName)?.value,
    country: request.headers.get('cf-ipcountry'),
    acceptLanguage: request.headers.get('accept-language'),
  });

  const url = request.nextUrl.clone();
  url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;

  // The target depends on the visitor, so it's a temporary redirect that no
  // shared cache (CDN) may store.
  const response = NextResponse.redirect(url, 307);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, CF-IPCountry, Accept-Language');
  return response;
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals, root metadata files and
    // requests for static assets (by extension, so legacy paths with dots in
    // IDs or usernames still get redirected).
    '/((?!api(?:/|$)|_next/|_vercel/|favicon\\.ico$|sitemap\\.xml$|robots\\.txt$|.*\\.(?:ico|png|jpe?g|gif|webp|avif|svg|css|js|map|txt|xml|json|webmanifest|woff2?|ttf|otf|mp3|mp4|webm)$).*)',
  ],
};
