import type { IncomingMessage, ServerResponse } from 'node:http';
import { json, readBody } from './fake-api-http.ts';

/**
 * Track routes of the fake API. `fake-artist-api-server.ts` serves them on the
 * same port (the e2e Next server has one `API_URL`), handing every
 * `/v1/tracks/*` and `/__track-mock/set` request to {@link serveTrackRequest}.
 * The Processing page reads its state on the server and polls it from the
 * browser, so both hit this fake; specs move a Track through its statuses with
 * {@link setTrackMock}.
 */

type FakeTrackProcessing = {
  status: string;
  failureCode?: string | null;
  resumeFrom?: string | null;
  retryable?: boolean;
  video?: { id: string; source: 'musicbrainz' | 'youtube_music' } | null;
};

export type FakeTrack = {
  id: string;
  title: string;
  coverUrl?: string | null;
  /** The artist credit as the Recording printed it, stored at creation. */
  artistCredit?: { name: string; joinPhrase: string }[];
  /** `null` for a Track that never had a Processing. */
  processing: FakeTrackProcessing | null;
  contributors?: {
    id: string;
    username: string | null;
    name: string;
    image: string | null;
  }[];
};

/** What `POST /v1/tracks` answers for one Recording MBID. */
type FakeTrackRequestAnswer =
  | { trackId: string; created: boolean }
  | { status: number; code: string; details?: unknown };

export type TrackMockState = {
  tracks?: FakeTrack[];
  legacyMap?: Record<string, string>;
  /** Keyed by `<recording MBID>:<locale>`, or by the MBID for every locale. */
  requests?: Record<string, FakeTrackRequestAnswer>;
};

/** Resolves the legacy-routes sample without any per-test setup. */
const defaultTrack: FakeTrack = {
  id: 'clx123abc',
  title: 'Bohemian Rhapsody',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  processing: { status: 'QUEUED' },
};

const tracks = new Map<string, FakeTrack>([[defaultTrack.id, defaultTrack]]);
const legacyMap = new Map<string, string>();
const requests = new Map<string, FakeTrackRequestAnswer>();

/** The Processing state of a Track, as the API answers it. */
function stateOf(track: FakeTrack) {
  const { processing } = track;
  return {
    track: {
      id: track.id,
      title: track.title,
      coverUrl: track.coverUrl ?? null,
      artistCredit: track.artistCredit ?? [],
    },
    processing:
      processing === null
        ? null
        : {
            id: `processing-${track.id}`,
            status: processing.status,
            failureCode: processing.failureCode ?? null,
            retryable: processing.retryable ?? false,
            resumeFrom: processing.resumeFrom ?? null,
            video: processing.video ?? null,
            createdAt: '2026-10-08T12:00:00.000Z',
            startedAt: null,
            finishedAt: null,
          },
    contributors: track.contributors ?? [],
  };
}

const notFoundBody = (
  code: 'NOT_FOUND' | 'RESOURCE_MOVED',
  details?: object,
) =>
  code === 'NOT_FOUND'
    ? { statusCode: 404, code, message: 'Track not found' }
    : { statusCode: 404, code, message: 'Track moved', details };

function serveProcessing(
  id: string,
  request: IncomingMessage,
  response: ServerResponse,
): void {
  const track = tracks.get(id);
  if (track) {
    json(response, 200, stateOf(track), request);
    return;
  }
  const newId = legacyMap.get(id);
  json(
    response,
    404,
    newId
      ? notFoundBody('RESOURCE_MOVED', { id: newId })
      : notFoundBody('NOT_FOUND'),
    request,
  );
}

async function serveCreate(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = (await readBody(request)) as {
    recordingMbid?: string;
    locale?: string;
  };
  const mbid = body.recordingMbid ?? '';
  // A locale-scoped answer wins, so specs of two locales that share a
  // Recording never answer each other's request.
  const answer =
    requests.get(`${mbid}:${body.locale ?? ''}`) ?? requests.get(mbid);
  if (answer === undefined) {
    json(
      response,
      404,
      { statusCode: 404, code: 'NOT_FOUND', message: 'Recording not found' },
      request,
    );
    return;
  }
  if ('code' in answer) {
    json(
      response,
      answer.status,
      {
        statusCode: answer.status,
        code: answer.code,
        message: 'Fake failure',
        details: answer.details,
      },
      request,
    );
    return;
  }
  json(
    response,
    answer.created ? 202 : 200,
    { trackId: answer.trackId },
    request,
  );
}

async function serveMockSet(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const state = (await readBody(request)) as TrackMockState;
  for (const track of state.tracks ?? []) tracks.set(track.id, track);
  for (const [legacyId, trackId] of Object.entries(state.legacyMap ?? {})) {
    legacyMap.set(legacyId, trackId);
  }
  for (const [mbid, answer] of Object.entries(state.requests ?? {})) {
    requests.set(mbid, answer);
  }
  json(response, 200, { ok: true }, request);
}

/**
 * Answers the track routes. Resolves `false` for any other request, which the
 * artist fake then answers (or 404s).
 */
export async function serveTrackRequest(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (request.method === 'POST' && pathname === '/__track-mock/set') {
    await serveMockSet(request, response);
    return true;
  }
  if (request.method === 'POST' && pathname === '/v1/tracks') {
    await serveCreate(request, response);
    return true;
  }
  const processing = /^\/v1\/tracks\/([^/]+)\/processing$/.exec(pathname);
  if (processing?.[1] && request.method === 'GET') {
    serveProcessing(decodeURIComponent(processing[1]), request, response);
    return true;
  }
  return false;
}

/**
 * Point the fake at a Track's state: upserts Tracks (by ID), legacy mappings
 * and the answers of `POST /v1/tracks` (by Recording MBID). Merged, never
 * reset, so parallel tests with distinct IDs never race.
 */
export async function setTrackMock(
  state: TrackMockState,
  baseUrl = 'http://127.0.0.1:3333',
): Promise<void> {
  const response = await fetch(`${baseUrl}/__track-mock/set`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!response.ok) {
    throw new Error(`setTrackMock failed with ${response.status}`);
  }
}
