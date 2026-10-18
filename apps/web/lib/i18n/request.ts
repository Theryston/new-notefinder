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
 * Outside the `[locale]` tree (the framework 404, and paths the proxy
 * forwards there) the locale is the one `proxy.ts` set. Only that case reads
 * `headers()`, so every page under `[locale]` stays static. Anything else,
 * such as an API path the proxy never sees, is English: the `en` catalog is
 * the source of truth, so the fallback goes through it rather than through
 * hard-coded strings.
 */
async function forwardedLocale(): Promise<string | undefined> {
  const value = (await headers()).get(localeHeaderName);
  return isLocale(value) ? value : 'en';
}

export default getRequestConfig(async ({ locale: override }) => {
  // `next/root-params` reads the `[locale]` segment from anywhere in the tree
  // (and keys 'use cache' entries by it), so pages stay statically
  // prerenderable without `setRequestLocale`. Route Handlers and Server
  // Actions can't read root params yet: pass `{ locale }` explicitly there.
  const locale =
    override ?? (await rootParams.locale()) ?? (await forwardedLocale());

  if (!isLocale(locale)) notFound();

  return {
    locale,
    messages: await catalogs[locale](),
  };
});
