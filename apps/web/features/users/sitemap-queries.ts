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
 * reaching a late file walks the earlier ones only once. The entries are
 * tagged `sitemap` so an API revalidation can drop them, but on main only the
 * track trending job sends it. Until the API revalidates when Users change,
 * the hourly `cacheLife` is the only freshness for Users: a removed or private
 * Profile can stay listed for up to an hour.
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
