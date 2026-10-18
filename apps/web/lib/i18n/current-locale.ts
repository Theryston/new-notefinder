import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { isLocale, type Locale } from './routing';

/**
 * The request's locale, narrowed to a supported one. `request.ts` already
 * rejects unknown locales, so the `notFound()` branch is a type guard, not a
 * reachable path.
 */
export async function currentLocale(): Promise<Locale> {
  const locale = await getLocale();
  if (!isLocale(locale)) notFound();
  return locale;
}
