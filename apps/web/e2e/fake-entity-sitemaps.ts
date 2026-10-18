import type { IncomingMessage, ServerResponse } from 'node:http';

import { json } from './fake-api-http.ts';

/**
 * `GET /v1/sitemaps/albums` and `/v1/sitemaps/artists` of the fake API: one
 * fixed page each, so the sitemap specs read the same list whichever spec
 * ran first. The web asks for a page of 5000 and gets everything at once.
 */
const updatedAt = '2026-10-14T12:00:00.000Z';

const sitemapAlbums = ['clx-sitemap-album-b', 'clx-sitemap-album-a'];
const sitemapArtists = ['clx-sitemap-artist-a'];

const listing = (ids: readonly string[]) => ({
  items: ids.map((id) => ({ id, updatedAt })),
  nextCursor: null,
});

export const serveAlbumSitemap = (
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  json(response, 200, listing(sitemapAlbums), request);
};

export const serveArtistSitemap = (
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  json(response, 200, listing(sitemapArtists), request);
};
