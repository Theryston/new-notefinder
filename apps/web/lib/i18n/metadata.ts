import type { Metadata } from 'next';

import { type Locale, routing } from './routing';

/**
 * The path a page is served at in one locale. The home page keeps the
 * canonical shape (`/<locale>`, no trailing slash). Sitemap URLs go through
 * here too, so the URL shape has a single source.
 */
export function localizedPath(locale: string, pathname: string): string {
  return `/${locale}${pathname === '/' ? '' : pathname}`;
}

/**
 * `alternates` for a page available in every locale: canonical URL plus
 * hreflang links. `x-default` points at the unprefixed path, which `proxy.ts`
 * redirects to the visitor's locale.
 *
 * Set per page (not in the root layout): the layout doesn't know the current
 * path, and a nested page inheriting the home page's hreflang would be wrong.
 */
export function localeAlternates(
  locale: Locale,
  pathname: `/${string}`,
): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = { 'x-default': pathname };
  for (const alternate of routing.locales) {
    languages[alternate] = localizedPath(alternate, pathname);
  }

  return { canonical: localizedPath(locale, pathname), languages };
}
