import { sitemapIndexXml } from '@/features/sitemap/sitemap-index-xml';
import {
  crawlerResponse,
  xmlContentType,
} from '@/lib/sitemap/crawler-response';
import { requestSiteOrigin } from '@/lib/sitemap/request-origin';

import { loadSitemapFileCounts } from './sitemap-file-counts';

/**
 * The sitemap index of the requesting domain. Built per request from the
 * host, so every domain lists its own absolute URLs, and lists every numeric
 * file the Albums, Artists and Users listings have.
 */
export async function GET(request: Request) {
  const origin = requestSiteOrigin(request);
  const counts = await loadSitemapFileCounts();
  return crawlerResponse(sitemapIndexXml(origin, counts), xmlContentType);
}
