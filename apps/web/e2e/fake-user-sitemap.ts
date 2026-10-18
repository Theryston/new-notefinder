import type { IncomingMessage, ServerResponse } from 'node:http';

import { json } from './fake-api-http.ts';

/** One User the Users sitemap lists: a Username, and an Avatar when there is one. */
type FakeSitemapUser = {
  id: string;
  username: string;
  image?: string;
};

/**
 * The Users the sitemap lists, in ID order. Only one has an Avatar, so the
 * spec can tell the image tag apart from the plain entries.
 */
const sitemapUsers: FakeSitemapUser[] = [
  {
    id: 'user-sitemap-ada',
    username: 'ada_lovelace',
  },
  {
    id: 'user-sitemap-grace',
    username: 'grace',
    image: 'https://lh3.googleusercontent.com/a/fake-grace-avatar',
  },
];

/**
 * `GET /v1/sitemaps/users`: the listed Users in one page (the fake keeps all
 * of them in the first file, so the cursor is always null).
 */
export function serveUserSitemap(
  request: IncomingMessage,
  response: ServerResponse,
): void {
  const items = sitemapUsers.map(({ id, username, image }) => ({
    id,
    username,
    updatedAt: '2026-10-14T12:00:00.000Z',
    ...(image ? { image } : {}),
  }));
  json(response, 200, { items, nextCursor: null }, request);
}
