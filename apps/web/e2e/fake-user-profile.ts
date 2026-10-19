import type { IncomingMessage, ServerResponse } from 'node:http';

import { json } from './fake-api-http.ts';

/**
 * The banner fields the fake API serves for one Profile. The chips are absent
 * (not null) when the User has nothing for them, as the API sends them.
 */
type FakeProfile = {
  name: string;
  image: string | null;
  createdAt: string;
  dailyPracticeTargetSeconds?: number;
  vocalRange?: { lowest: number; highest: number };
  mostSungArtist?: { id: string; name: string };
};

/** Profiles by lowercased username, as the API stores them. */
const profiles = new Map<string, FakeProfile>([
  [
    'ada_lovelace',
    {
      name: 'Ada Lovelace',
      image: null,
      createdAt: '2026-01-02T03:04:05.000Z',
    },
  ],
  [
    'grace_hopper',
    {
      name: 'Grace Hopper',
      image: null,
      createdAt: '2026-03-04T05:06:07.000Z',
      dailyPracticeTargetSeconds: 900,
      vocalRange: { lowest: 48, highest: 74 },
      mostSungArtist: {
        id: 'artist-orquestra',
        name: 'Orquestra Sinfônica Brasileira de Câmara Antônio Carlos',
      },
    },
  ],
]);

/** `/v1/users/:username`, the Profile banner path (any casing). */
const isUserProfilePath = (pathname: string): boolean =>
  /^\/v1\/users\/[^/]+$/.test(pathname);

/**
 * Serves the banner of a known Profile (any casing), or the API's `NOT_FOUND`
 * envelope for an unknown username. `pathname` is one `isUserProfilePath`
 * accepted.
 */
async function serveUserProfile(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  const username = decodeURIComponent(pathname.slice('/v1/users/'.length));
  const normalized = username.toLowerCase();
  if (normalized === 'broken') {
    json(
      response,
      500,
      { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Broken on purpose' },
      request,
    );
    return;
  }
  const profile = profiles.get(normalized);
  if (!profile) {
    json(
      response,
      404,
      { statusCode: 404, code: 'NOT_FOUND', message: 'User not found' },
      request,
    );
    return;
  }
  json(response, 200, { username: normalized, ...profile }, request);
}

/** The route of `GET /v1/users/:username` in the fake API's table. */
export const userProfileRoute = {
  method: 'GET',
  pathname: isUserProfilePath,
  serve: serveUserProfile,
};
