/**
 * The rules of the home feed: its row shapes, paging and cache lifetimes. See
 * docs/adr/0011-home-feed-architecture.md. Bumping the algorithm version
 * changes the feed version even when the rows look the same.
 */

import type { Locale } from '@notefinder/contracts';

export const HOME_ALGORITHM_VERSION = 1;

/**
 * The feed a request gets when it names no locale. An unsupported locale is
 * refused by the query schema, so only the feed locales ever reach the feed.
 */
export const DEFAULT_HOME_LOCALE: Locale = 'en';

/** Rows per page: the first page and every later one. */
export const HOME_PAGE_SIZE = 6;

/**
 * The most rows a feed holds. Matches the `rows` limit of `homeFeedSchema` in
 * @notefinder/contracts, which hard-codes the same 24.
 */
export const HOME_MAX_ROWS = 24;

/** Most Tracks of one artist in one row, so a hot artist can't fill it. */
export const MAX_TRACKS_PER_ARTIST_PER_ROW = 2;

export type HomeLayout = 'hero' | 'standard';

export type HomeRowRule = {
  minItems: number;
  maxItems: number;
  /** Heroes show a cover, so only Tracks that have one qualify. */
  requiresCover: boolean;
};

export const HOME_ROW_RULES = {
  hero: { minItems: 1, maxItems: 1, requiresCover: true },
  standard: { minItems: 6, maxItems: 12, requiresCover: false },
} as const satisfies Record<HomeLayout, HomeRowRule>;

/** The current feed lives this long, so a stalled regeneration still serves it. */
export const HOME_FEED_CURRENT_TTL_SECONDS = 2 * 60 * 60;

/** A replaced feed stays reachable for cursors this long. */
export const HOME_FEED_RETAINED_TTL_SECONDS = 30 * 60;

/** The lock one request holds while it builds a missing feed. */
export const HOME_FEED_LOCK_TTL_SECONDS = 30;

/**
 * A signed-in response differs from the public one: it omits the visitors-only
 * pins. No shared cache may keep it, or serve it to a visitor who is not signed in.
 */
export const PRIVATE_HOME_CACHE_CONTROL = 'private, no-store';

/** Shared caches keep a public feed for a few minutes and serve it stale after. */
export const PUBLIC_HOME_CACHE_CONTROL =
  'public, max-age=60, s-maxage=600, stale-while-revalidate=3600';

/** A fallback feed is never stored by a cache, so it can't outlive the outage. */
export const UNCACHED_HOME_CACHE_CONTROL = 'no-store';
