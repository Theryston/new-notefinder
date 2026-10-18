import 'server-only';

import {
  cacheTags,
  SITEMAP_PAGE_SIZE,
  type UserSitemapPage,
  userSitemapPageSchema,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverApi } from '@/lib/api/server';

/**
 * One page of the Users sitemap, after `cursor`. Cached per cursor, so
 * reaching a late file walks the earlier ones only once. The API revalidates
 * the sitemap tag when the listed Users change; the hour is the backstop.
 */
async function getUserSitemapPage(
  cursor: string | undefined,
): Promise<UserSitemapPage> {
  'use cache';
  cacheTag(cacheTags.sitemap);
  cacheLife('hours');

  return serverApi('/sitemaps/users', {
    query: { limit: SITEMAP_PAGE_SIZE, cursor },
    schema: userSitemapPageSchema,
  });
}

/** The `index`th sitemap file's Users, or undefined past the last file. */
export async function getUserSitemapFile(
  index: number,
): Promise<UserSitemapPage['items'] | undefined> {
  let cursor: string | undefined;
  for (let page = 0; page < index; page++) {
    const { nextCursor } = await getUserSitemapPage(cursor);
    if (nextCursor === null) return undefined;
    cursor = nextCursor;
  }
  return (await getUserSitemapPage(cursor)).items;
}
