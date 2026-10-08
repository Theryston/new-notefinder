import type { FakeTrack } from './fake-artist-tracks.ts';

/**
 * Fake album track listing for the album Playwright suite: pure pagination
 * in album order (disc, then track position, then track ID), with no HTTP.
 * Kept apart from `fake-album-api-server.ts` for the file-size gate.
 */

export type FakeAlbumDisc = { position: number; title: string | null };

/** A track on an album: the card fields, its disc and its track position. */
export type FakeAlbumTrack = FakeTrack & {
  disc: FakeAlbumDisc;
  trackPosition: number;
};

type SortKey = [disc: number, track: number, id: string];

const encodeCursor = (key: SortKey): string =>
  Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');

/** The sort key a cursor names, or undefined when it is not one this fake issued. */
const decodeCursor = (cursor: string): SortKey | undefined => {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (!Array.isArray(parsed) || parsed.length !== 3) return undefined;
    const [disc, track, id] = parsed;
    if (
      typeof disc === 'number' &&
      typeof track === 'number' &&
      typeof id === 'string'
    ) {
      return [disc, track, id];
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const keyOf = (track: FakeAlbumTrack): SortKey => [
  track.disc.position,
  track.trackPosition,
  track.id,
];

/** Negative when `a` comes before `b` in album order. */
const compareKeys = (a: SortKey, b: SortKey): number => {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0;
};

/** A listed track: what the wire carries (no track position). */
type ListedAlbumTrack = FakeTrack & { disc: FakeAlbumDisc };

export type FakeAlbumTracksPage =
  | {
      status: 200;
      body: { items: ListedAlbumTrack[]; nextCursor: string | null };
    }
  | { status: 400; body: { statusCode: 400; code: string; message: string } };

const badRequest = (message: string): FakeAlbumTracksPage => ({
  status: 400,
  body: { statusCode: 400, code: 'VALIDATION_FAILED', message },
});

/** Cursor-paginates the album's tracks in album order. */
export function paginateFakeAlbumTracks(
  allTracks: FakeAlbumTrack[],
  search: URLSearchParams,
): FakeAlbumTracksPage {
  const rawLimit = search.get('limit');
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return badRequest('Invalid limit');
  }
  const rawCursor = search.get('cursor');
  const after = rawCursor ? decodeCursor(rawCursor) : undefined;
  if (rawCursor && !after) return badRequest('Invalid cursor');

  const sorted = [...allTracks].sort((a, b) => compareKeys(keyOf(a), keyOf(b)));
  const start = after
    ? sorted.findIndex((track) => compareKeys(keyOf(track), after) > 0)
    : 0;
  const from = start === -1 ? sorted.length : start;
  const page = sorted.slice(from, from + limit);
  const last = page.at(-1);
  const hasMore = from + limit < sorted.length;
  return {
    status: 200,
    body: {
      items: page.map(({ trackPosition: _ignored, ...track }) => track),
      nextCursor: hasMore && last ? encodeCursor(keyOf(last)) : null,
    },
  };
}
