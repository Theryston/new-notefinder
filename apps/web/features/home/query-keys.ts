import type { Locale } from '@notefinder/contracts';

/** Keys of the home's client queries; one feed per locale. */
export const homeQueryKeys = {
  rows: (locale: Locale) => ['home', 'rows', locale] as const,
};
