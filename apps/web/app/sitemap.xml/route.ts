import { sitemapIndexXml } from '@/features/sitemap/sitemap-index-xml';
import {
  crawlerResponse,
  xmlContentType,
} from '@/lib/sitemap/crawler-response';
import { requestSiteOrigin } from '@/lib/sitemap/request-origin';

/**
 * The sitemap index of the requesting domain. Built per request from the
 * host, so every domain lists its own absolute URLs.
 */
export function GET(request: Request) {
  return crawlerResponse(
    sitemapIndexXml(requestSiteOrigin(request)),
    xmlContentType,
  );
}
