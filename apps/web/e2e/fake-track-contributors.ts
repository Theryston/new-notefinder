import type { IncomingMessage, ServerResponse } from 'node:http';
import { json } from './fake-api-http.ts';
import type { FakeTrack } from './fake-track-types.ts';

type ContributorsContext = {
  tracks: Map<string, FakeTrack>;
  legacyMap: Map<string, string>;
};

/**
 * One page of the Track's Contributors with search and total, over the same
 * in-memory mocks as the header. Cursors are plain offsets: the dialog under
 * test passes them through untouched.
 */
export function serveTrackContributors(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  context: ContributorsContext,
): boolean {
  const route = /^\/v1\/tracks\/([^/]+)\/contributors$/.exec(pathname);
  if (route?.[1] === undefined || request.method !== 'GET') return false;
  const id = decodeURIComponent(route[1]);
  const track = context.tracks.get(id);
  if (track === undefined) {
    const newId = context.legacyMap.get(id);
    json(
      response,
      404,
      newId === undefined
        ? { statusCode: 404, code: 'NOT_FOUND', message: 'Track not found' }
        : {
            statusCode: 404,
            code: 'RESOURCE_MOVED',
            message: 'Track moved',
            details: { id: newId },
          },
      request,
    );
    return true;
  }
  const params = new URL(request.url ?? '', 'http://fake').searchParams;
  const limit = Math.min(
    Math.max(Number.parseInt(params.get('limit') ?? '20', 10) || 20, 1),
    100,
  );
  const query = (params.get('q') ?? '').trim().toLowerCase();
  const all = track.contributors ?? [];
  const matching =
    query === ''
      ? all
      : all.filter(
          (contributor) =>
            contributor.name.toLowerCase().includes(query) ||
            (contributor.username ?? '').toLowerCase().includes(query),
        );
  const start = Number.parseInt(params.get('cursor') ?? '0', 10) || 0;
  const items = matching.slice(start, start + limit);
  const next = start + limit;
  json(
    response,
    200,
    {
      items,
      nextCursor: next < matching.length ? String(next) : null,
      total: matching.length,
    },
    request,
  );
  return true;
}
