import type { CursorPage, SitemapEntry } from '@notefinder/contracts';
import { decodeSitemapCursor, encodeSitemapCursor } from './sitemap-cursor.js';

/** A listed row as its repository reads it: the ID and the last change. */
export type SitemapRow = { id: string; updatedAt: Date };

/**
 * Turns the `limit + 1` rows a repository was asked for into one page. The
 * extra row only tells whether another page follows; the cursor ends the page.
 */
const toSitemapPage = (
  rows: SitemapRow[],
  limit: number,
): CursorPage<SitemapEntry> => {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items: items.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt.toISOString(),
    })),
    nextCursor:
      rows.length > limit && last ? encodeSitemapCursor(last.id) : null,
  };
};

/**
 * One page of an entity sitemap listing: decodes the cursor (refusing one
 * this API did not issue), asks the repository for `limit + 1` rows after it,
 * and shapes the page.
 */
export const listSitemapPage = async (
  query: { cursor?: string; limit: number },
  fetchAfter: (
    after: string | undefined,
    take: number,
  ) => Promise<SitemapRow[]>,
): Promise<CursorPage<SitemapEntry>> => {
  const after =
    query.cursor === undefined ? undefined : decodeSitemapCursor(query.cursor);
  return toSitemapPage(await fetchAfter(after, query.limit + 1), query.limit);
};
