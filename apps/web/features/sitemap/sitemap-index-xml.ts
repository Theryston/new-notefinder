import {
  buildSitemapIndex,
  type SitemapShardRef,
} from '@/lib/sitemap/sitemap-xml';

/**
 * How many numeric files each listing has. The index lists every one of them,
 * so a crawler finds the later shards of a type without a manual submission.
 */
export type SitemapFileCounts = {
  albums: number;
  artists: number;
  users: number;
};

/** Each listing at its first file only: the index before the counts are known. */
const firstFileOnly: SitemapFileCounts = { albums: 1, artists: 1, users: 1 };

/** The numeric files `<type>/sitemap/0.xml` … `<type>/sitemap/<count-1>.xml`. */
const filesOf = (type: string, count: number): SitemapShardRef[] =>
  Array.from({ length: count }, (_, index) => ({
    segments: [type, 'sitemap', `${index}.xml`],
  }));

/**
 * The sitemap index for a domain, its shards at absolute URLs. Pages and Tracks
 * list their first file; Albums, Artists and Users list every file they have.
 */
export function sitemapIndexXml(
  siteUrl: string,
  counts: SitemapFileCounts = firstFileOnly,
): string {
  const shards: SitemapShardRef[] = [
    { segments: ['pages', 'sitemap', '0.xml'] },
    { segments: ['tracks', 'sitemap', '0.xml'] },
    ...filesOf('albums', counts.albums),
    ...filesOf('artists', counts.artists),
    ...filesOf('users', counts.users),
  ];
  return buildSitemapIndex(shards, siteUrl);
}
