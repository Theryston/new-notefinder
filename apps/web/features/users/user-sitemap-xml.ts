import type { UserSitemapEntry } from '@vozzify/contracts';

import {
  buildSitemapUrlset,
  type SitemapUrlEntry,
} from '@/lib/sitemap/sitemap-xml';

/** A Profile is addressed by its Username, which the entry carries. */
const userSitemapEntry = (entry: UserSitemapEntry): SitemapUrlEntry => ({
  segments: ['users', entry.username],
  updatedAt: entry.updatedAt,
  type: 'user',
});

/**
 * The sitemap file for a page of Users, in the order given (the API sends them
 * by ID). Each Profile is listed once per locale, each URL pointing at all of
 * its translations.
 */
export function userSitemapXml(
  entries: readonly UserSitemapEntry[],
  siteUrl: string,
): string {
  return buildSitemapUrlset(entries.map(userSitemapEntry), siteUrl);
}
