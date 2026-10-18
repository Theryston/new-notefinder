import { getArtistSitemapFile } from '@/features/artists/sitemap-queries';
import { entitySitemapResponse } from '@/lib/sitemap/entity-sitemap';
import { requestSiteOrigin } from '@/lib/sitemap/request-origin';

/**
 * The Artists sitemap, at the legacy app's URLs (`/artists/sitemap/0.xml`):
 * the Artists with a completed Track, in ID order, for the requested host.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return entitySitemapResponse({
    type: 'artist',
    path: (await params).path,
    siteUrl: requestSiteOrigin(request),
    readFile: getArtistSitemapFile,
  });
}
