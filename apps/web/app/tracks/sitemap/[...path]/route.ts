import { getTrackSitemapFile } from '@/features/tracks/sitemap-queries';
import {
  sitemapPageIndex,
  trackSitemapXml,
} from '@/features/tracks/track-sitemap-xml';
import { getSiteUrl } from '@/lib/env/client';

/**
 * The Tracks sitemap, at the legacy app's URLs (`/tracks/sitemap/0.xml`):
 * completed Tracks, the highest trending score first. The proxy leaves `.xml`
 * paths alone, so these URLs keep their shape.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const index = sitemapPageIndex((await params).path);
  const entries =
    index === undefined ? undefined : await getTrackSitemapFile(index);
  if (entries === undefined) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(trackSitemapXml(entries, getSiteUrl().origin), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
