import { getTrackSitemapFile } from '@/features/tracks/sitemap-queries';
import { trackSitemapXml } from '@/features/tracks/track-sitemap-xml';
import { requestSiteOrigin } from '@/lib/sitemap/request-origin';
import { sitemapFileResponse } from '@/lib/sitemap/sitemap-file-response';

/**
 * The Tracks sitemap, at the legacy app's URLs (`/tracks/sitemap/0.xml`):
 * completed Tracks, the highest trending score first, written for the
 * requesting host like the other sitemap files. The proxy leaves `.xml` paths
 * alone, so these URLs keep their shape.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const origin = requestSiteOrigin(request);
  return sitemapFileResponse({
    name: 'tracks',
    path: (await params).path,
    read: getTrackSitemapFile,
    toXml: (entries) => trackSitemapXml(entries, origin),
  });
}
