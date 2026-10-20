import { cacheTags, type Locale } from '@notefinder/contracts';

import { type HomeFeedPage, homeFeedPageSchema } from './feed-page';

/** The web cache tag of one locale's public feed; the API revalidates it. */
export const publicHomeCacheTag = (locale: Locale): string =>
  cacheTags.home(locale);

/**
 * The API call behind the cached public feed. It never forwards the visitor's
 * cookies: a shared cache must only ever hold the answer for everyone.
 */
export const publicHomeRequest = (locale: Locale) =>
  ({
    query: { locale },
    schema: homeFeedPageSchema,
    forwardCookies: false,
  }) as const;

/**
 * Refuses any page that is not the public audience, so a personal feed can
 * never be written into the shared cache (the error is not cached either).
 */
export function acceptPublicFeed(page: HomeFeedPage): HomeFeedPage {
  if (page.audience !== 'public') {
    throw new Error(
      `The public home cache received a "${page.audience}" feed, refusing it`,
    );
  }
  return page;
}
