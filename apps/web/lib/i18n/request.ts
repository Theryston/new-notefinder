import type { ApiErrorCode } from '@notefinder/contracts';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import * as rootParams from 'next/root-params';
import { getRequestConfig } from 'next-intl/server';

import type en from '@/messages/en.json';

import { localeHeaderName } from './locale-header';
import { isLocale, type Locale } from './routing';

// `en` is the source of truth: every other catalog must have the same keys,
// and every API error code must have a translation.
type Catalog = typeof en & { errors: Record<ApiErrorCode, string> };

const catalogs = {
  en: () => import('@/messages/en.json').then((module) => module.default),
  'pt-BR': () =>
    import('@/messages/pt-BR.json').then((module) => module.default),
} satisfies Record<Locale, () => Promise<Catalog>>;

/**
 * The locale for a page outside the `[locale]` tree, which is the framework
 * 404: the one `proxy.ts` forwarded on its locale-prefixed paths and on the
 * catalog rewrite. Paths the proxy skips (`/api/...`, files with extensions)
 * get no header, so they fall back to English. A client can send the header
 * to any path; on those paths it only changes the language of the framework
 * 404 it sees. Only this case reads `headers()`, so every page under
 * `[locale]` stays static. The `en` catalog answers the fallback, not
 * hard-coded strings.
 */
async function localeOutsideLocaleTree(): Promise<Locale> {
  const value = (await headers()).get(localeHeaderName);
  return isLocale(value) ? value : 'en';
}

export default getRequestConfig(async ({ locale: override }) => {
  // `next/root-params` reads the `[locale]` segment from anywhere in the tree
  // (and keys 'use cache' entries by it), so pages stay statically
  // prerenderable without `setRequestLocale`. Route Handlers and Server
  // Actions can't read root params yet: pass `{ locale }` explicitly there.
  const locale =
    override ??
    (await rootParams.locale()) ??
    (await localeOutsideLocaleTree());

  if (!isLocale(locale)) notFound();

  return {
    locale,
    messages: await catalogs[locale](),
  };
});
