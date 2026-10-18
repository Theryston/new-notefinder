import { getArtistSitemapFile } from '@/features/artists/sitemap-queries';
import { entitySitemapGet } from '@/lib/sitemap/entity-sitemap';

/**
 * The Artists sitemap, at the legacy app's URLs (`/artists/sitemap/0.xml`):
 * the Artists with a completed Track, in ID order, for the requested host.
 */
export const GET = entitySitemapGet('artist', getArtistSitemapFile);
