import type { IncomingMessage, ServerResponse } from 'node:http';

import { json } from './fake-api-http.ts';

/** One User the Users sitemap lists: its ID and its Username. */
type FakeSitemapUser = {
  id: string;
  username: string;
};

/** The Users the sitemap lists, in ID order. */
const sitemapUsers: FakeSitemapUser[] = [
  { id: 'user-sitemap-ada', username: 'ada_lovelace' },
  { id: 'user-sitemap-grace', username: 'grace' },
];

/**
 * `GET /v1/sitemaps/users`: the listed Users in one page (the fake keeps all
 * of them in the first file, so the cursor is always null).
 */
export async function serveUserSitemap(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const items = sitemapUsers.map(({ id, username }) => ({
    id,
    username,
    updatedAt: '2026-10-14T12:00:00.000Z',
  }));
  json(response, 200, { items, nextCursor: null }, request);
}
