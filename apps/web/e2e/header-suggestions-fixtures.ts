import type { Page, Request, Route } from '@playwright/test';

import { type FakeTrack, setTrackMock } from './fake-track-api';
import { corsHeaders } from './search-api-mock';

/**
 * A 1x1 PNG answered for every optimized image: the browser asks the Next
 * image route, so the cover is the browser's own request and no upstream
 * (the Cover Art Archive) is reached.
 */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

const mbidOf = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A Cover Art Archive front of a release (the image route is answered above). */
const coverOf = (n: number): string =>
  `https://coverartarchive.org/release/${mbidOf(n)}/front-500`;

export type Hit = {
  title: string;
  artist: string;
  trackId: string | null;
  coverArtUrl?: string;
};

/**
 * Six Recordings in the order the catalog ranks them. The order is neither
 * alphabetical nor "Tracks first" (the first hit has no Track), so a sort
 * or a reorder by Track status shows up in the row assertions.
 */
export const RANKED: Hit[] = [
  {
    title: 'Under Pressure',
    artist: 'Queen & David Bowie',
    trackId: null,
    coverArtUrl: coverOf(101),
  },
  { title: 'Radio Ga Ga', artist: 'Queen', trackId: 'seedtrack02' },
  { title: 'Bohemian Rhapsody', artist: 'Queen', trackId: 'seedtrack01' },
  { title: 'We Will Rock You', artist: 'Queen', trackId: 'seedtrack03' },
  { title: 'Killer Queen', artist: 'Queen', trackId: 'seedtrack04' },
  { title: 'Somebody to Love', artist: 'Queen', trackId: null },
];

function resultBody(hit: Hit, index: number) {
  return {
    mbid: mbidOf(index + 1),
    title: hit.title,
    lengthMs: null,
    disambiguation: '',
    video: false,
    artistCredit: { name: hit.artist, artists: [] },
    genres: [],
    primaryRelease: hit.coverArtUrl
      ? {
          mbid: mbidOf(index + 500),
          title: hit.title,
          year: 1980,
          coverArtUrl: hit.coverArtUrl,
        }
      : null,
    trackId: hit.trackId,
  };
}

/**
 * Serves the public search for the header suggestions. Like the API, it
 * answers at most `limit` hits in the order given. Returns the requests seen.
 */
export async function mockSuggestions(page: Page, hits: Hit[] = RANKED) {
  const calls: Request[] = [];
  await page.route('**/v1/search**', async (route: Route) => {
    const request = route.request();
    const headers = corsHeaders(request);
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    calls.push(request);
    const limit = Number(
      new URL(request.url()).searchParams.get('limit') ?? 20,
    );
    await route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({ results: hits.slice(0, limit).map(resultBody) }),
    });
  });
  return calls;
}

/**
 * Registers a processed Track with the fake track API, so its Track page
 * renders (an unknown ID is a 404 page without the site header).
 */
export async function registerTrack(id: string) {
  const track: FakeTrack = {
    id,
    title: 'Radio Ga Ga',
    artistCredit: [{ name: 'Queen', joinPhrase: '' }],
    durationMs: 248_000,
    processing: { status: 'COMPLETED' },
    notes: [{ pitch: 64, start: 2, end: 3 }],
    contributors: [],
  };
  await setTrackMock({ tracks: [track] });
}

export function lastOf(calls: Request[]): Request {
  const last = calls.at(-1);
  if (!last) throw new Error('expected a suggestions request');
  return last;
}
