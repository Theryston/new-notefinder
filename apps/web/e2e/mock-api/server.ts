/**
 * A stand-in for the API at `API_URL` (see e2e/web-server-env.ts) while the
 * production build is tested (Playwright and Lighthouse): the artist and
 * album routes over the fixtures, plain SVG covers, and the error envelope
 * for everything else. Run with `node e2e/mock-api/server.ts`.
 */
import { createServer, type ServerResponse } from 'node:http';

import { MOCK_API_PORT, mockCollectionsByPath } from './fixtures.ts';

const send = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

const notFound = (response: ServerResponse) =>
  send(response, 404, {
    statusCode: 404,
    code: 'NOT_FOUND',
    message: 'Not found',
  });

const cover = (response: ServerResponse, name: string) => {
  // A stable color per cover, so the grid looks like a grid of covers.
  let hue = 0;
  for (const char of name) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  response.writeHead(200, {
    'content-type': 'image/svg+xml',
    'cache-control': 'public, max-age=31536000, immutable',
  });
  response.end(
    `<svg xmlns="http://www.w3.org/2000/svg" width="544" height="544"><rect width="544" height="544" fill="hsl(${hue} 60% 45%)"/></svg>`,
  );
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  // The browser loads the pages after the first one with the session
  // cookie, cross-origin.
  const origin = request.headers.origin;
  if (origin) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('access-control-allow-credentials', 'true');
  }

  if (url.pathname.startsWith('/covers/')) {
    return cover(response, url.pathname);
  }

  const isTracks = url.pathname.endsWith('/tracks');
  const collection =
    mockCollectionsByPath[url.pathname.replace(/\/tracks$/, '')];
  if (!collection) return notFound(response);
  if (!isTracks) return send(response, 200, collection.owner);

  const pageIndex = Number(url.searchParams.get('cursor') ?? 0);
  const items = collection.pages[pageIndex];
  if (!items) {
    return send(response, 400, {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Invalid cursor',
    });
  }
  const hasNext = pageIndex + 1 < collection.pages.length;
  return send(response, 200, {
    items,
    nextCursor: hasNext ? String(pageIndex + 1) : null,
  });
});

// No host: IPv6 and IPv4 both, since builds may inline `localhost` (which
// can resolve to ::1) as the browser's API URL.
server.listen(MOCK_API_PORT);
