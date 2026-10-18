import { getTrackSitemapFile } from '@/features/tracks/sitemap-queries';
import { trackSitemapXml } from '@/features/tracks/track-sitemap-xml';
import { getSiteUrl } from '@/lib/env/client';
import { sitemapFileResponse } from '@/lib/sitemap/sitemap-file-response';

/**
 * The Tracks sitemap, at the legacy app's URLs (`/tracks/sitemap/0.xml`):
 * completed Tracks, the highest trending score first. The proxy leaves `.xml`
 * paths alone, so these URLs keep their shape.
 *
 * Its URLs use the site origin, not the requested host (the other sitemap
 * files answer for the requested host). Switching it needs the route's unit
 * test to mock `@/lib/sitemap/request-origin`, see the PR notes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const origin = getSiteUrl().origin;
  return sitemapFileResponse({
    name: 'tracks',
    path: (await params).path,
    read: getTrackSitemapFile,
    toXml: (entries) => trackSitemapXml(entries, origin),
  });
}
