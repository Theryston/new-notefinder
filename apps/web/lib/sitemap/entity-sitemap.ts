import type { SitemapEntry } from '@notefinder/contracts';

import { requestSiteOrigin } from '@/lib/sitemap/request-origin';
import { sitemapFileResponse } from '@/lib/sitemap/sitemap-file-response';
import {
  buildSitemapUrlset,
  type SitemapContentType,
} from '@/lib/sitemap/sitemap-xml';

/** The entity types whose sitemap lists one entry per record. */
export type EntitySitemapType = Extract<SitemapContentType, 'album' | 'artist'>;

/**
 * The sitemap file for a page of entities, in the order given. Each entity is
 * listed once per locale at its public URL (`/albums/<id>`), with the type's
 * priority and changefreq from the shared content meta.
 */
export function entitySitemapXml(
  type: EntitySitemapType,
  entries: readonly SitemapEntry[],
  siteUrl: string,
): string {
  return buildSitemapUrlset(
    entries.map((entry) => ({
      segments: [`${type}s`, entry.id],
      updatedAt: entry.updatedAt,
      type,
    })),
    siteUrl,
  );
}

/**
 * The answer for an entity sitemap path: the file as XML for the requested
 * origin, or not found. A path that is not a shard never reads the API.
 */
export function entitySitemapResponse(options: {
  type: EntitySitemapType;
  path: readonly string[];
  siteUrl: string;
  readFile: (index: number) => Promise<SitemapEntry[] | undefined>;
}): Promise<Response> {
  return sitemapFileResponse({
    name: `${options.type}s`,
    path: options.path,
    read: options.readFile,
    toXml: (entries) =>
      entitySitemapXml(options.type, entries, options.siteUrl),
  });
}

/**
 * The `GET` handler of an entity sitemap route: the same answer for every
 * type, so each route only names its type and its file reader.
 */
export function entitySitemapGet(
  type: EntitySitemapType,
  readFile: (index: number) => Promise<SitemapEntry[] | undefined>,
) {
  return async (
    request: Request,
    { params }: { params: Promise<{ path: string[] }> },
  ): Promise<Response> =>
    entitySitemapResponse({
      type,
      path: (await params).path,
      siteUrl: requestSiteOrigin(request),
      readFile,
    });
}
