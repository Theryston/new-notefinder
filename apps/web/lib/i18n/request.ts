import type { ApiErrorCode } from '@notefinder/contracts';
import { notFound } from 'next/navigation';
import * as rootParams from 'next/root-params';
import { getRequestConfig } from 'next-intl/server';

import type en from '@/messages/en.json';

import { isLocale, type Locale } from './routing';

// `en` is the source of truth: every other catalog must have the same keys,
// and every API error code must have a translation.
type Catalog = typeof en & { errors: Record<ApiErrorCode, string> };

const catalogs = {
  en: () => import('@/messages/en.json').then((module) => module.default),
  'pt-BR': () =>
    import('@/messages/pt-BR.json').then((module) => module.default),
} satisfies Record<Locale, () => Promise<Catalog>>;

export default getRequestConfig(async ({ locale: override }) => {
  // `next/root-params` reads the `[locale]` segment from anywhere in the tree
  // (and keys 'use cache' entries by it), so pages stay statically
  // prerenderable without `setRequestLocale`. Route Handlers and Server
  // Actions can't read root params yet: pass `{ locale }` explicitly there.
  const locale = override ?? (await rootParams.locale());

  if (!isLocale(locale)) notFound();

  return {
    locale,
    messages: await catalogs[locale](),
  };
});
