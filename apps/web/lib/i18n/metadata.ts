import type { Metadata } from 'next';

import { type Locale, routing } from './routing';

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
  const suffix = pathname === '/' ? '' : pathname;
  const languages: Record<string, string> = { 'x-default': pathname };
  for (const alternate of routing.locales) {
    languages[alternate] = `/${alternate}${suffix}`;
  }

  return { canonical: `/${locale}${suffix}`, languages };
}
