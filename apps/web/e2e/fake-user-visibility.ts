import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ProfileSection, ProfileVisibility } from '@notefinder/contracts';

import { json, readBody } from './fake-api-http.ts';

/**
 * Section visibility of the fake API. The Next server reads a Profile's
 * sections with the browser's cookies, so a spec signs its owner in on the
 * server side with {@link OWNER_COOKIE} (the browser session is mocked
 * separately, as for every signed-in spec). A section the owner hid answers
 * the API's `NOT_FOUND` to anyone else, as the real API does.
 */

/** The cookie that signs a request in as the owner of one Profile. */
export const OWNER_COOKIE = 'notefinder-e2e-owner';

/** The API's address, where specs reach the fake to set its state. */
const FAKE_API = 'http://127.0.0.1:3333';

const SHOWN: ProfileVisibility = {
  summary: true,
  practiceHistory: true,
  favorites: true,
};

/** Hidden flags by lowercased username; a Profile not listed shows every section. */
const visibilityByUsername = new Map<string, ProfileVisibility>();

/** The username the request is signed in as the owner of, if any. */
const ownerOf = (request: IncomingMessage): string | undefined =>
  /(?:^|;\s*)notefinder-e2e-owner=([^;]+)/.exec(
    request.headers.cookie ?? '',
  )?.[1];

/** Whether the request may read a section: the owner always, a visitor when it is shown. */
export const canReadSection = (
  request: IncomingMessage,
  username: string,
  section: ProfileSection,
): boolean => {
  if (ownerOf(request) === username) return true;
  return (visibilityByUsername.get(username) ?? SHOWN)[section];
};

/** The API's answer to a visitor who asks for a hidden section. */
export const hiddenSectionReply = (
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  json(
    response,
    404,
    { statusCode: 404, code: 'NOT_FOUND', message: 'Section not found' },
    request,
  );
};

/** `GET /v1/me`: the owner the cookie signs in as, else the API's `UNAUTHORIZED`. */
const serveMe = (request: IncomingMessage, response: ServerResponse): void => {
  const owner = ownerOf(request);
  if (!owner) {
    json(
      response,
      401,
      { statusCode: 401, code: 'UNAUTHORIZED', message: 'No valid session' },
      request,
    );
    return;
  }
  json(
    response,
    200,
    {
      id: `usr_${owner}`,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      emailVerified: true,
      username: owner,
      image: null,
      role: 'USER',
      createdAt: '2026-01-02T03:04:05.000Z',
      dailyPracticeTargetSeconds: null,
    },
    request,
  );
};

/**
 * `POST /__visibility-mock/set`: replaces the hidden flags with the ones
 * given, keyed by username. Specs call {@link setProfileVisibilityMock}.
 */
const serveVisibilityMockSet = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const body = (await readBody(request)) as
    | { visibility?: Record<string, ProfileVisibility> }
    | undefined;
  visibilityByUsername.clear();
  for (const [username, flags] of Object.entries(body?.visibility ?? {})) {
    visibilityByUsername.set(username.toLowerCase(), flags);
  }
  json(response, 200, { ok: true }, request);
};

/** Sets the visibility of the Profiles named, and shows every other one. */
export const setProfileVisibilityMock = async (
  visibility: Record<string, ProfileVisibility>,
): Promise<void> => {
  const response = await fetch(`${FAKE_API}/__visibility-mock/set`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visibility }),
  });
  if (!response.ok) {
    throw new Error(`Visibility mock refused (${response.status})`);
  }
};

/** The routes the fake API serves for section visibility. */
export const userVisibilityRoutes = [
  {
    method: 'GET',
    pathname: '/v1/me',
    serve: (request: IncomingMessage, response: ServerResponse) => {
      serveMe(request, response);
      return Promise.resolve();
    },
  },
  {
    method: 'POST',
    pathname: '/__visibility-mock/set',
    serve: serveVisibilityMockSet,
  },
];
