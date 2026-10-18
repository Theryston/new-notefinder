import { getUserSitemapFile } from '@/features/users/sitemap-queries';
import { userSitemapXml } from '@/features/users/user-sitemap-xml';
import { requestSiteOrigin } from '@/lib/sitemap/request-origin';
import { sitemapFileResponse } from '@/lib/sitemap/sitemap-file-response';

/**
 * The Users sitemap, numeric shards (`/users/sitemap/0.xml`): the Profiles
 * with a Username, in ID order. Written for the requesting host, like the
 * index that points here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const origin = requestSiteOrigin(request);
  return sitemapFileResponse({
    name: 'users',
    path: (await params).path,
    read: getUserSitemapFile,
    toXml: (entries) => userSitemapXml(entries, origin),
  });
}
