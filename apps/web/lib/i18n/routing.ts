import { defineRouting } from 'next-intl/routing';

export const localeCookieName = 'NEXT_LOCALE';

/**
 * Request header the proxy sets with the URL locale on every locale-prefixed
 * request (and on its `/_not-found` rewrite). The root `not-found` has no
 * `[locale]` segment, so without this it could only guess the language from
 * cookies/headers and would mistranslate shared links opened by visitors with
 * another language.
 */
export const requestLocaleHeader = 'x-notefinder-locale';

export const routing = defineRouting({
  locales: ['en', 'pt-BR'],
  defaultLocale: 'en',
  localePrefix: 'always',
  // Written by next-intl's navigation APIs when the user switches locale and
  // read by `proxy.ts`. Kept for a year instead of next-intl's default session
  // cookie so the choice survives browser restarts.
  localeCookie: { name: localeCookieName, maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: string | undefined | null): value is Locale {
  return routing.locales.some((locale) => locale === value);
}
