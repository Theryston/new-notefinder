import 'server-only';

import {
  cacheTags,
  TRACK_SITEMAP_PAGE_SIZE,
  type TrackSitemapPage,
  trackSitemapPageSchema,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverApi } from '@/lib/api/server';

/**
 * One page of the Tracks sitemap, after `cursor`. Cached per cursor, so
 * reaching a late file walks the earlier ones only once. The API revalidates
 * the sitemap tag when scores change; the hour is the backstop for Tracks
 * that complete in between.
 */
async function getTrackSitemapPage(
  cursor: string | undefined,
): Promise<TrackSitemapPage> {
  'use cache';
  cacheTag(cacheTags.sitemap);
  cacheLife('hours');

  return serverApi('/sitemaps/tracks', {
    query: { limit: TRACK_SITEMAP_PAGE_SIZE, cursor },
    schema: trackSitemapPageSchema,
  });
}

/** The `index`th sitemap file's Tracks, or undefined past the last file. */
export async function getTrackSitemapFile(
  index: number,
): Promise<TrackSitemapPage['items'] | undefined> {
  let cursor: string | undefined;
  for (let page = 0; page < index; page++) {
    const { nextCursor } = await getTrackSitemapPage(cursor);
    if (nextCursor === null) return undefined;
    cursor = nextCursor;
  }
  return (await getTrackSitemapPage(cursor)).items;
}
