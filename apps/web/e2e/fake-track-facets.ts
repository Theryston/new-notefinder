import type { IncomingMessage, ServerResponse } from 'node:http';
import { json } from './fake-api-http.ts';
import type { FakeTrack } from './fake-track-types.ts';

type FacetContext = {
  tracks: Map<string, FakeTrack>;
  read: (
    id: string,
    request: IncomingMessage,
    response: ServerResponse,
    body: (track: FakeTrack) => unknown,
  ) => void;
};

const facetBodies = {
  recommendations: (track: FakeTrack) => ({
    tracks: (track.recommendations ?? []).map((entry) => ({
      id: entry.id,
      title: entry.title,
      coverUrl: entry.coverUrl ?? null,
      artistCredit: entry.artistCredit ?? [],
    })),
  }),
  notes: (track: FakeTrack) => ({ notes: track.notes ?? [] }),
  lyrics: (track: FakeTrack) => ({ lines: track.lyrics ?? [] }),
};

/** Shared fake subresources keep the read routes consistent, including failures. */
export function serveTrackFacet(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  context: FacetContext,
): boolean {
  const facet = /^\/v1\/tracks\/([^/]+)\/(notes|lyrics|recommendations)$/.exec(
    pathname,
  );
  if (!facet?.[1] || request.method !== 'GET') return false;
  const id = decodeURIComponent(facet[1]);
  const name =
    facet[2] === 'notes'
      ? 'notes'
      : facet[2] === 'recommendations'
        ? 'recommendations'
        : 'lyrics';
  if (name === 'notes' && context.tracks.get(id)?.notesFail === true) {
    json(
      response,
      400,
      { statusCode: 400, code: 'BAD_REQUEST', message: 'Fake' },
      request,
    );
    return true;
  }
  context.read(id, request, response, facetBodies[name]);
  return true;
}
