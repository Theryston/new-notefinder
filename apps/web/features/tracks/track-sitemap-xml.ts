import type { TrackSitemapEntry } from '@vozzify/contracts';

import { sitemapShardIndex } from '@/lib/sitemap/sitemap-shard';
import {
  buildSitemapUrlset,
  type SitemapUrlEntry,
} from '@/lib/sitemap/sitemap-xml';

const trackUrlEntry = (entry: TrackSitemapEntry): SitemapUrlEntry => ({
  segments: ['tracks', entry.id],
  updatedAt: entry.updatedAt,
  type: 'track',
  images: entry.coverUrl ? [{ loc: entry.coverUrl }] : undefined,
});

/**
 * The sitemap file for a page of Tracks, in the order given (the API sends
 * the highest trending score first). Each Track is listed once per locale,
 * each URL pointing at all of its translations, with its cover as an image
 * when it has one.
 */
export function trackSitemapXml(
  entries: readonly TrackSitemapEntry[],
  siteUrl: string,
): string {
  return buildSitemapUrlset(entries.map(trackUrlEntry), siteUrl);
}

/** The page index a legacy-style sitemap path names (`0.xml` is page 0). */
export function sitemapPageIndex(path: readonly string[]): number | undefined {
  return sitemapShardIndex(path);
}
