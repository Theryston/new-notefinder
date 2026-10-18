import type { CursorPage } from '@notefinder/contracts';
import { decodeSitemapCursor, encodeSitemapCursor } from './sitemap-cursor.js';

/** A listed row as its repository reads it: the ID and the last change, plus any extra fields. */
export type SitemapRow = { id: string; updatedAt: Date };

/** A row as the listing answers it: its last change as an ISO 8601 string. */
export type SerializedSitemapRow<TRow extends SitemapRow> = Omit<
  TRow,
  'updatedAt'
> & { updatedAt: string };

/**
 * Turns the `limit + 1` rows a repository was asked for into one page. The
 * extra row only tells whether another page follows; the cursor ends the page.
 */
const toSitemapPage = <TRow extends SitemapRow>(
  rows: TRow[],
  limit: number,
): CursorPage<SerializedSitemapRow<TRow>> => {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items: items.map(({ updatedAt, ...rest }) => ({
      ...rest,
      updatedAt: updatedAt.toISOString(),
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
export const listSitemapPage = async <TRow extends SitemapRow>(
  query: { cursor?: string; limit: number },
  fetchAfter: (after: string | undefined, take: number) => Promise<TRow[]>,
): Promise<CursorPage<SerializedSitemapRow<TRow>>> => {
  const after =
    query.cursor === undefined ? undefined : decodeSitemapCursor(query.cursor);
  return toSitemapPage(await fetchAfter(after, query.limit + 1), query.limit);
};
