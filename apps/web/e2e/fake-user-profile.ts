import type { IncomingMessage, ServerResponse } from 'node:http';

import { json } from './fake-api-http.ts';
import { userFavoritesRoute } from './fake-user-favorites.ts';

/** The banner fields the fake API serves for one Profile. */
type FakeProfile = {
  name: string;
  image: string | null;
  createdAt: string;
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
    'katherine_johnson',
    {
      name: 'Katherine Johnson',
      image: null,
      createdAt: '2026-01-02T03:04:05.000Z',
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
const userProfileRoute = {
  method: 'GET',
  pathname: isUserProfilePath,
  serve: serveUserProfile,
};

/** Every route of the Profile page: the banner and its favorite songs. */
export const userProfileRoutes = [userProfileRoute, userFavoritesRoute];
