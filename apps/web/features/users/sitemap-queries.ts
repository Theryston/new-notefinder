import 'server-only';

import {
  cacheTags,
  SITEMAP_PAGE_SIZE,
  type UserSitemapPage,
  userSitemapPageSchema,
} from '@vozzify/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverApi } from '@/lib/api/server';
import {
  countSitemapFiles,
  sitemapFileItems,
} from '@/lib/sitemap/sitemap-file';

/**
 * One page of the Users sitemap, after `cursor`. Cached per cursor, so
 * reaching a late file walks the earlier ones only once. The entries are
 * tagged `sitemap`, but the API only sends that tag when a Track completes or
 * scores change, not when a User changes. Until it does, the hourly
 * `cacheLife` is the only freshness for Users: a removed or private Profile
 * can stay listed for up to an hour.
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
export function getUserSitemapFile(index: number) {
  return sitemapFileItems(getUserSitemapPage, index);
}

/** How many sitemap files the Users listing has (at least one). */
export function countUserSitemapFiles(): Promise<number> {
  return countSitemapFiles('users', getUserSitemapPage);
}
