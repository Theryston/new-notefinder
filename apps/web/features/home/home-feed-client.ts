import type { Locale } from '@notefinder/contracts';

import { browserApi } from '@/lib/api/browser';

import { homeFeedPageSchema } from './feed-page';

/**
 * Fetches the next page of rows straight from the API. Loaded on the first
 * scroll (`import()` in the query), so the schema's Zod stays out of the
 * page's first-load JavaScript.
 */
export function fetchHomePageInBrowser({
  locale,
  cursor,
  signal,
}: {
  locale: Locale;
  cursor: string | undefined;
  signal: AbortSignal;
}) {
  return browserApi('/home', {
    schema: homeFeedPageSchema,
    query: { locale, cursor },
    signal,
  });
}
