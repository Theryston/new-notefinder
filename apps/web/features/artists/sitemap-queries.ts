import 'server-only';

import {
  type ArtistSitemapPage,
  artistSitemapPageSchema,
  cacheTags,
  SITEMAP_PAGE_SIZE,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverApi } from '@/lib/api/server';
import {
  countSitemapFiles,
  sitemapFileItems,
} from '@/lib/sitemap/sitemap-file';

/**
 * One page of the Artists sitemap, after `cursor`. Cached per cursor; the API
 * revalidates the sitemap tag when Artists change, the hour is the backstop.
 */
async function getArtistSitemapPage(
  cursor: string | undefined,
): Promise<ArtistSitemapPage> {
  'use cache';
  cacheTag(cacheTags.sitemap);
  cacheLife('hours');

  return serverApi('/sitemaps/artists', {
    query: { limit: SITEMAP_PAGE_SIZE, cursor },
    schema: artistSitemapPageSchema,
  });
}

/** The `index`th sitemap file's Artists, or undefined past the last file. */
export function getArtistSitemapFile(index: number) {
  return sitemapFileItems(getArtistSitemapPage, index);
}

/** How many sitemap files the Artists listing has (at least one). */
export function countArtistSitemapFiles(): Promise<number> {
  return countSitemapFiles('artists', getArtistSitemapPage);
}
