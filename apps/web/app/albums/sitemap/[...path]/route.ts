import { getAlbumSitemapFile } from '@/features/albums/sitemap-queries';
import { entitySitemapGet } from '@/lib/sitemap/entity-sitemap';

/**
 * The Albums sitemap, at the legacy app's URLs (`/albums/sitemap/0.xml`):
 * the Albums with a completed Track, in ID order, for the requested host.
 */
export const GET = entitySitemapGet('album', getAlbumSitemapFile);
