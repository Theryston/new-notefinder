import 'server-only';

import {
  cacheTags,
  TRACK_SITEMAP_PAGE_SIZE,
  type TrackSitemapPage,
  trackSitemapPageSchema,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverApi } from '@/lib/api/server';
import { sitemapFileItems } from '@/lib/sitemap/sitemap-file';

/**
 * One page of the Tracks sitemap, after `cursor`. Cached per cursor, so
 * reaching a late file walks the earlier ones only once. The API revalidates
 * the sitemap tag when a Track completes or scores change; the hour is the
 * backstop for the rest.
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
export function getTrackSitemapFile(index: number) {
  return sitemapFileItems(getTrackSitemapPage, index);
}
