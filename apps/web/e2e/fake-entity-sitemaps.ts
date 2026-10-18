import type { IncomingMessage, ServerResponse } from 'node:http';

import { json } from './fake-api-http.ts';

/**
 * `GET /v1/sitemaps/albums` and `/v1/sitemaps/artists` of the fake API. They
 * page like the real listings: `limit` and an opaque `cursor`, with the
 * limit+1 lookahead, so a last page that is exactly full has no next cursor.
 *
 * The fake caps each page at `fakePageSize` (2) whatever the web asks for.
 * The web asks for 5000 per API page, so with that cap each of its sitemap
 * files is one small page, and a few fake entities span several files.
 */
const fakePageSize = 2;
const updatedAt = '2026-10-14T12:00:00.000Z';

const sitemapAlbumIds = Array.from(
  { length: 6 },
  (_, index) => `clx-sitemap-album-${index + 1}`,
);
const sitemapArtistIds = Array.from(
  { length: 5 },
  (_, index) => `clx-sitemap-artist-${index + 1}`,
);

const encodeCursor = (id: string): string =>
  Buffer.from(id).toString('base64url');
const decodeCursor = (cursor: string): string =>
  Buffer.from(cursor, 'base64url').toString();

/** One listing page of `ids` (sorted), as the API answers it. */
const pageOf = (ids: readonly string[], request: IncomingMessage) => {
  const url = new URL(request.url ?? '/', 'http://fake-api.local');
  const requested = Number(url.searchParams.get('limit') ?? fakePageSize);
  const limit = Math.min(requested, fakePageSize);
  const cursor = url.searchParams.get('cursor');
  const after = cursor === null ? undefined : decodeCursor(cursor);
  const rest = ids.filter((id) => after === undefined || id > after);
  const items = rest.slice(0, limit);
  const last = items.at(-1);
  return {
    items: items.map((id) => ({ id, updatedAt })),
    nextCursor:
      rest.length > limit && last !== undefined ? encodeCursor(last) : null,
  };
};

export const serveAlbumSitemap = (
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  json(response, 200, pageOf(sitemapAlbumIds, request), request);
};

export const serveArtistSitemap = (
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  json(response, 200, pageOf(sitemapArtistIds, request), request);
};
