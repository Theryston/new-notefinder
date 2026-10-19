import type { IncomingMessage, ServerResponse } from 'node:http';

import type { PublicProfileSummary } from '@notefinder/contracts';

import { json } from './fake-api-http.ts';

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
    // One day and nothing else: the singular forms of the Summary section.
    'grace_hopper',
    {
      name: 'Grace Hopper',
      image: null,
      createdAt: '2026-03-04T05:06:07.000Z',
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

/** Summaries by lowercased username, as the API stores them. */
const summaries = new Map<string, PublicProfileSummary>([
  [
    'ada_lovelace',
    {
      streakDays: 4,
      sungCount: 1250,
      favoritesCount: 7,
      contributionsCount: 1,
    },
  ],
  [
    'grace_hopper',
    {
      streakDays: 1,
      sungCount: 0,
      favoritesCount: 0,
      contributionsCount: 0,
    },
  ],
]);

/** `/v1/users/:username/summary`, the Summary numbers path (any casing). */
const isUserProfileSummaryPath = (pathname: string): boolean =>
  /^\/v1\/users\/[^/]+\/summary$/.test(pathname);

/**
 * Serves the Summary numbers of a known Profile, or the API's `NOT_FOUND`
 * envelope for an unknown username. `pathname` is one
 * `isUserProfileSummaryPath` accepted.
 */
async function serveUserProfileSummary(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  const username = decodeURIComponent(
    pathname.slice('/v1/users/'.length, -'/summary'.length),
  );
  const summary = summaries.get(username.toLowerCase());
  if (!summary) {
    json(
      response,
      404,
      { statusCode: 404, code: 'NOT_FOUND', message: 'User not found' },
      request,
    );
    return;
  }
  json(response, 200, summary, request);
}

/**
 * The routes of `GET /v1/users/:username` and `GET /v1/users/:username/summary`
 * in the fake API's table: one entry, dispatching on the path.
 */
export const userProfileRoute = {
  method: 'GET',
  pathname: (pathname: string): boolean =>
    isUserProfilePath(pathname) || isUserProfileSummaryPath(pathname),
  serve: (
    request: IncomingMessage,
    response: ServerResponse,
    pathname: string,
  ): Promise<void> =>
    isUserProfileSummaryPath(pathname)
      ? serveUserProfileSummary(request, response, pathname)
      : serveUserProfile(request, response, pathname),
};
