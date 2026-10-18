import 'server-only';

import { countAlbumSitemapFiles } from '@/features/albums/sitemap-queries';
import { countArtistSitemapFiles } from '@/features/artists/sitemap-queries';
import type { SitemapFileCounts } from '@/features/sitemap/sitemap-index-xml';
import { countUserSitemapFiles } from '@/features/users/sitemap-queries';

/**
 * How many numeric files the Albums, Artists and Users listings have, read in
 * parallel. Each count walks cached pages, so the index costs little per
 * request.
 */
export async function loadSitemapFileCounts(): Promise<SitemapFileCounts> {
  const [albums, artists, users] = await Promise.all([
    countAlbumSitemapFiles(),
    countArtistSitemapFiles(),
    countUserSitemapFiles(),
  ]);
  return { albums, artists, users };
}
