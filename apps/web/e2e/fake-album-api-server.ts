import type { IncomingMessage, ServerResponse } from 'node:http';

import { json, readBody } from './fake-api-http.ts';

/**
 * Album routes of the fake API. `fake-artist-api-server.ts` serves them on
 * the same port (the e2e Next server has one `API_URL`), handing every
 * `/v1/albums/*` and `/__album-mock/set` request to
 * {@link serveAlbumRequest}. Album specs drive it through
 * {@link setAlbumMock}, which merges fixtures so parallel tests never race.
 */

type FakeAlbumArtist = { id: string; name: string };

export type FakeAlbum = {
  id: string;
  mbid: string;
  title: string;
  primaryType: string | null;
  secondaryTypes: string[];
  year: number | null;
  genres: string[];
  coverArtUrl: string | null;
  /** In credit order. */
  artists: FakeAlbumArtist[];
  /** Artificial latency per reply, so the loading skeleton can be seen. */
  delayMs?: number;
};

export type AlbumMockState = {
  albums?: FakeAlbum[];
  legacyMap?: Record<string, string>;
};

/** Resolves the legacy-routes sample without any per-test setup. */
export const defaultAlbum: FakeAlbum = {
  id: 'clx789ghi',
  mbid: '00000000-0000-4000-8000-00000000a001',
  title: 'A Night at the Opera',
  primaryType: 'Album',
  secondaryTypes: [],
  year: 1975,
  genres: ['rock', 'pop'],
  coverArtUrl: null,
  artists: [{ id: 'clx456def', name: 'Queen' }],
};

const albums = new Map<string, FakeAlbum>([[defaultAlbum.id, defaultAlbum]]);
const legacyMap = new Map<string, string>();

const serveAlbum = async (
  id: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const album = albums.get(id);
  if (album) {
    if (album.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, album.delayMs));
    }
    const { delayMs: _ignored, ...body } = album;
    json(response, 200, body, request);
    return;
  }
  const newId = legacyMap.get(id);
  if (newId) {
    json(
      response,
      404,
      {
        statusCode: 404,
        code: 'RESOURCE_MOVED',
        message: 'Album moved',
        details: { id: newId },
      },
      request,
    );
    return;
  }
  json(
    response,
    404,
    { statusCode: 404, code: 'NOT_FOUND', message: 'Album not found' },
    request,
  );
};

const serveMockSet = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const state = (await readBody(request)) as AlbumMockState;
  for (const album of state.albums ?? []) albums.set(album.id, album);
  for (const [legacyId, albumId] of Object.entries(state.legacyMap ?? {})) {
    legacyMap.set(legacyId, albumId);
  }
  json(response, 200, { ok: true }, request);
};

/**
 * Point the e2e Next server at album fixtures: upserts albums and legacy
 * mappings (merged, never reset, like `setArtistMock`).
 */
export const setAlbumMock = async (
  state: AlbumMockState,
  baseUrl = 'http://127.0.0.1:3333',
): Promise<void> => {
  const response = await fetch(`${baseUrl}/__album-mock/set`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!response.ok) {
    throw new Error(`setAlbumMock failed with ${response.status}`);
  }
};

/** A valid 1x1 PNG: a cover the optimizer can decode, with no network. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

/**
 * The Cover Art Archive stand-in that `cover-upstream.mjs` sends the image
 * optimizer to: a PNG, or a 404 for a release group whose MBID ends in `dead`
 * (a cover that fails to load).
 */
const serveCover = (mbid: string, response: ServerResponse): void => {
  if (mbid.endsWith('dead')) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': 'image/png' }).end(PIXEL_PNG);
};

/**
 * Answers the album routes. Resolves `false` for any other request, which
 * the artist fake then answers (or 404s).
 */
export const serveAlbumRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  if (request.method === 'POST' && pathname === '/__album-mock/set') {
    await serveMockSet(request, response);
    return true;
  }
  const match = /^\/v1\/albums\/([^/]+)$/.exec(pathname);
  if (match?.[1] && request.method === 'GET') {
    await serveAlbum(decodeURIComponent(match[1]), request, response);
    return true;
  }
  const cover = /^\/__cover\/release-group\/([^/]+)\/front-500$/.exec(pathname);
  if (cover?.[1] && request.method === 'GET') {
    serveCover(cover[1], response);
    return true;
  }
  return false;
};
