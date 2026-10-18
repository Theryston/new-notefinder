import type { TrackSitemapEntry } from '@notefinder/contracts';

import {
  buildSitemapUrlset,
  parseSitemapShardName,
} from '@/lib/sitemap/sitemap-xml';

/**
 * The sitemap file for a page of Tracks, in the order given (the API sends
 * the highest trending score first). Each Track is listed once per locale,
 * each URL pointing at all of its translations.
 */
export function trackSitemapXml(
  entries: readonly TrackSitemapEntry[],
  siteUrl: string,
): string {
  return buildSitemapUrlset(
    entries.map((entry) => ({
      segments: ['tracks', entry.id],
      updatedAt: entry.updatedAt,
      type: 'track' as const,
    })),
    siteUrl,
  );
}

/** The page index a legacy-style sitemap path names (`0.xml` is page 0). */
export function sitemapPageIndex(path: readonly string[]): number | undefined {
  if (path.length !== 1) return undefined;
  const name = path[0];
  if (name === undefined) return undefined;
  return parseSitemapShardName(name);
}
