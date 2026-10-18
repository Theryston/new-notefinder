import type { IncomingMessage, ServerResponse } from 'node:http';

import { json } from './fake-api-http.ts';
import type { FakeTrack } from './fake-track-api.ts';

/**
 * The Tracks sitemap caches its first page, so these are in the fake from the
 * start: whichever spec reads the sitemap first sees the same list.
 */
export const sitemapTracks: FakeTrack[] = [
  { id: 'clx-sitemap-cold', title: 'Cold', viewCount: 3 },
  { id: 'clx-sitemap-hot', title: 'Hot', viewCount: 900 },
  { id: 'clx-sitemap-processing', title: 'Processing', viewCount: 5000 },
].map((track) => ({
  ...track,
  processing: {
    status: track.id.endsWith('processing') ? 'QUEUED' : 'COMPLETED',
  },
}));

/** The covers the fake listing carries; a Track missing here has none. */
const sitemapCovers = new Map([
  [
    'clx-sitemap-hot',
    'https://files.notefinder.example/covers/clx-sitemap-hot.webp',
  ],
]);

/**
 * `GET /v1/sitemaps/tracks`: the completed Tracks in one page, the most viewed
 * first (the fake's stand-in for the trending score).
 */
export function serveSitemap(
  all: readonly FakeTrack[],
  request: IncomingMessage,
  response: ServerResponse,
): void {
  const items = all
    .filter((track) => track.processing?.status === 'COMPLETED')
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    .map(({ id }) => ({
      id,
      updatedAt: '2026-10-14T12:00:00.000Z',
      coverUrl: sitemapCovers.get(id) ?? null,
    }));
  json(response, 200, { items, nextCursor: null }, request);
}
