import {
  crawlerResponse,
  fullCacheControl,
  partialCacheControl,
  xmlContentType,
} from '@/lib/sitemap/crawler-response';
import { readSitemapFile } from '@/lib/sitemap/sitemap-file';
import { sitemapShardIndex } from '@/lib/sitemap/sitemap-shard';

/**
 * The answer for one numeric file of a sitemap listing (`<path>/<n>.xml`): the
 * file as XML, a partial file when the upstream read failed, or not found past
 * the last file. A path that is not a shard never reads the upstream.
 */
export async function sitemapFileResponse<TItem>(options: {
  /** Names the file in the server log, e.g. `tracks`. */
  name: string;
  path: readonly string[];
  read: (index: number) => Promise<readonly TItem[] | undefined>;
  toXml: (items: readonly TItem[]) => string;
}): Promise<Response> {
  const { name, path, read, toXml } = options;
  const index = sitemapShardIndex(path);
  if (index === undefined) return notFound();

  const file = await readSitemapFile(`${name}/${index}.xml`, () => read(index));
  if (file === undefined) return notFound();

  return crawlerResponse(
    toXml(file.items),
    xmlContentType,
    file.partial ? partialCacheControl : fullCacheControl,
  );
}

const notFound = (): Response => new Response('Not found', { status: 404 });
