import { robotsTxt } from '@/features/sitemap/robots-txt';
import {
  crawlerResponse,
  textContentType,
} from '@/lib/sitemap/crawler-response';
import { requestSiteOrigin } from '@/lib/sitemap/request-origin';

/** robots.txt of the requesting domain, pointing at that domain's index. */
export function GET(request: Request) {
  return crawlerResponse(
    robotsTxt(requestSiteOrigin(request)),
    textContentType,
  );
}
