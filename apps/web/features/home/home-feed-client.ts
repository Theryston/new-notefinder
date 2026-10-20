import { homeFeedPageSchema, type Locale } from '@notefinder/contracts';

import { browserApi } from '@/lib/api/browser';

/** One request for a page of rows: the locale and the cursor to resume from. */
export type HomePageRequest = {
  locale: Locale;
  cursor: string | undefined;
  signal: AbortSignal;
};

/**
 * Fetches a page of rows straight from the API. Loaded on the first scroll
 * (`import()` in the query), so the schema's Zod stays out of the page's
 * first-load JavaScript.
 */
export function fetchHomePageInBrowser({
  locale,
  cursor,
  signal,
}: HomePageRequest) {
  return browserApi('/home', {
    schema: homeFeedPageSchema,
    query: { locale, cursor },
    signal,
  });
}
