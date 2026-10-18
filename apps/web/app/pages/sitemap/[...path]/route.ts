import { generalPagesSitemapXml } from '@/features/sitemap/general-pages-sitemap-xml';
import {
  crawlerResponse,
  xmlContentType,
} from '@/lib/sitemap/crawler-response';
import { requestSiteOrigin } from '@/lib/sitemap/request-origin';
import { sitemapShardIndex } from '@/lib/sitemap/sitemap-shard';

/**
 * The general-pages shard (`/pages/sitemap/0.xml`). The curated list fits in
 * one file, so `0.xml` is the only one; any other path is not found.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (sitemapShardIndex(path) !== 0) {
    return new Response('Not found', { status: 404 });
  }
  return crawlerResponse(
    generalPagesSitemapXml(requestSiteOrigin(request)),
    xmlContentType,
  );
}
