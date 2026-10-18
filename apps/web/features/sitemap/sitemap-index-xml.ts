import {
  buildSitemapIndex,
  type SitemapShardRef,
} from '@/lib/sitemap/sitemap-xml';

/**
 * The five content sitemaps every domain's index points at, each at its
 * first file. Later numeric shards of a type are listed once that type
 * outgrows one file.
 */
const contentSitemapShards: readonly SitemapShardRef[] = [
  { segments: ['pages', 'sitemap', '0.xml'] },
  { segments: ['tracks', 'sitemap', '0.xml'] },
  { segments: ['albums', 'sitemap', '0.xml'] },
  { segments: ['artists', 'sitemap', '0.xml'] },
  { segments: ['users', 'sitemap', '0.xml'] },
];

/** The sitemap index for a domain, its shards at absolute URLs. */
export function sitemapIndexXml(siteUrl: string): string {
  return buildSitemapIndex(contentSitemapShards, siteUrl);
}
