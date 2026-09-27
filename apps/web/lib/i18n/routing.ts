import { defineRouting } from 'next-intl/routing';

export const localeCookieName = 'NEXT_LOCALE';

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
