/**
 * What the `tiny` dataset seeds after the empty MusicBrainz schema is
 * created: a few hundred deterministic Recordings, generated from their
 * index alone, so every restore of `tiny` lays down byte-identical rows.
 * The future Lyrics import generates its fake dump from exactly these
 * entries (same MBIDs and titles), which is why they are pure data here
 * and the SQL lives in `TinySeedRepository`.
 */

export const TINY_RECORDING_COUNT = 300;

export const TINY_ARTIST_COUNT = 20;

export type TinySeedRecording = {
  /** The Recording's MBID, fixed for its index. */
  mbid: string;
  title: string;
  /** The credited artist's MBID, fixed for its index. */
  artistMbid: string;
  artistName: string;
  lengthMs: number;
};

const pad = (value: number, width: number): string =>
  String(value).padStart(width, '0');

/** Fixed MBIDs of a readable series: `tinyRecordingMbid(7)` ends in `...000007`. */
export const tinyRecordingMbid = (n: number): string =>
  `22222222-2222-4222-8222-${pad(n, 12)}`;

export const tinyArtistMbid = (n: number): string =>
  `33333333-3333-4333-8333-${pad(n, 12)}`;

export const tinyArtistCreditMbid = (n: number): string =>
  `44444444-4444-4444-8444-${pad(n, 12)}`;

/**
 * The Recordings `tiny` seeds, in seed order: twenty artists take turns
 * down the list, so a search for one artist finds its fifteen songs and a
 * search for a title finds exactly one Recording.
 */
export const tinySeedRecordings = (
  count: number = TINY_RECORDING_COUNT,
): TinySeedRecording[] =>
  Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const artist = ((n - 1) % TINY_ARTIST_COUNT) + 1;
    return {
      mbid: tinyRecordingMbid(n),
      title: `Tiny Song ${pad(n, 3)}`,
      artistMbid: tinyArtistMbid(artist),
      artistName: `Tiny Artist ${pad(artist, 2)}`,
      lengthMs: 180_000 + n * 100,
    };
  });
