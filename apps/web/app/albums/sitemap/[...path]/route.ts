import { getAlbumSitemapFile } from '@/features/albums/sitemap-queries';
import { entitySitemapResponse } from '@/lib/sitemap/entity-sitemap';
import { requestSiteOrigin } from '@/lib/sitemap/request-origin';

/**
 * The Albums sitemap, at the legacy app's URLs (`/albums/sitemap/0.xml`):
 * the Albums with a completed Track, in ID order, for the requested host.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return entitySitemapResponse({
    type: 'album',
    path: (await params).path,
    siteUrl: requestSiteOrigin(request),
    readFile: getAlbumSitemapFile,
  });
}
