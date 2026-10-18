import { getUserSitemapFile } from '@/features/users/sitemap-queries';
import { userSitemapXml } from '@/features/users/user-sitemap-xml';
import {
  crawlerResponse,
  xmlContentType,
} from '@/lib/sitemap/crawler-response';
import { requestSiteOrigin } from '@/lib/sitemap/request-origin';
import { sitemapShardIndex } from '@/lib/sitemap/sitemap-shard';

/**
 * The Users sitemap, numeric shards (`/users/sitemap/0.xml`): the Profiles
 * with a Username, in ID order. Written for the requesting host, like the
 * index that points here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const index = sitemapShardIndex((await params).path);
  const entries =
    index === undefined ? undefined : await getUserSitemapFile(index);
  if (entries === undefined) {
    return new Response('Not found', { status: 404 });
  }
  return crawlerResponse(
    userSitemapXml(entries, requestSiteOrigin(request)),
    xmlContentType,
  );
}
