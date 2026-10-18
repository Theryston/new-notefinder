import { parseSitemapShardName } from '@/lib/sitemap/sitemap-xml';

/**
 * The shard a sitemap path names: a single numeric file (`['0.xml']` is
 * shard 0). Anything else, including extra path segments, is undefined so the
 * route answers not found without reading anything.
 */
export function sitemapShardIndex(path: readonly string[]): number | undefined {
  if (path.length !== 1) return undefined;
  const name = path[0];
  if (name === undefined) return undefined;
  return parseSitemapShardName(name);
}
