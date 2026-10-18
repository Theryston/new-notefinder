import 'server-only';

import {
  type AlbumSitemapPage,
  albumSitemapPageSchema,
  cacheTags,
  SITEMAP_PAGE_SIZE,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverApi } from '@/lib/api/server';
import { sitemapFileItems } from '@/lib/sitemap/sitemap-file';

/**
 * One page of the Albums sitemap, after `cursor`. Cached per cursor; the API
 * revalidates the sitemap tag when Albums change, the hour is the backstop.
 */
async function getAlbumSitemapPage(
  cursor: string | undefined,
): Promise<AlbumSitemapPage> {
  'use cache';
  cacheTag(cacheTags.sitemap);
  cacheLife('hours');

  return serverApi('/sitemaps/albums', {
    query: { limit: SITEMAP_PAGE_SIZE, cursor },
    schema: albumSitemapPageSchema,
  });
}

/** The `index`th sitemap file's Albums, or undefined past the last file. */
export function getAlbumSitemapFile(index: number) {
  return sitemapFileItems(getAlbumSitemapPage, index);
}
