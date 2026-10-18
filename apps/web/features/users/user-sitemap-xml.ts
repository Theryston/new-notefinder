import type { UserSitemapEntry } from '@notefinder/contracts';

import {
  buildSitemapUrlset,
  type SitemapImage,
  type SitemapUrlEntry,
} from '@/lib/sitemap/sitemap-xml';

/**
 * The Avatar as an image of the Profile, when there is one that a crawler can
 * fetch. Only absolute http(s) URLs are listed: anything else is left out
 * rather than written into the file.
 */
const avatarImages = (
  image: string | null | undefined,
): SitemapImage[] | undefined => {
  if (!image || !isHttpUrl(image)) return undefined;
  return [{ loc: image }];
};

const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

/** A Profile is addressed by its Username, which the entry carries. */
const userSitemapEntry = (entry: UserSitemapEntry): SitemapUrlEntry => ({
  segments: ['users', entry.username],
  updatedAt: entry.updatedAt,
  type: 'user',
  images: avatarImages(entry.image),
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
