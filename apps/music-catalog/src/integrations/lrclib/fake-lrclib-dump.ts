import { type DumpTrack, writeLrclibDump } from './write-lrclib-dump.js';

/** One Recording the fake dump is generated from. */
export type FakeDumpRecording = {
  mbid: string;
  title: string;
  /** The printed artist credit. */
  artist: string;
  lengthMs: number | null;
  /** Release titles; the first is used as the album. */
  albums: string[];
};

/** Fixed seed: the same Recordings always produce the same dump. */
const FAKE_LRCLIB_SEED = 63;

const mulberry32 = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type PendingTrack = {
  title: string;
  artist: string;
  album: string;
  duration: number;
  token: string;
};

const plainLyrics = (track: PendingTrack): string =>
  `Fake lyrics for "${track.title}" by ${track.artist}\n${track.token} drifting on and on\n${track.token} still drifting on`;

const syncedLyrics = (track: PendingTrack): string =>
  `[00:01.00] Fake lyrics for "${track.title}" by ${track.artist}\n[00:05.00] ${track.token} drifting on and on\n[00:09.00] ${track.token} still drifting on`;

// The exact track of a Recording, a quarter second or less from its length,
// so the ±2 s rule keeps it while the length near-miss (2.5 s further out)
// always stays outside it. Near-misses (length, live, remix, tie) are added
// by the caller for the Recordings that play those roles.
const exactTrack = (
  recording: FakeDumpRecording,
  index: number,
  duration: number,
): PendingTrack => ({
  title: recording.title,
  artist: recording.artist,
  album: recording.albums[0] ?? '',
  duration,
  token: `fake-lrclib-${index}`,
});

// The near-misses of the first Recording: each must look close but never
// match (length just outside ±2 s, a live and a remix title, and a tie on two
// albums that are not its own, so the tie-breaker leaves it unmatched... the
// exact row still wins its own tie by album).
const nearMisses = (
  recording: FakeDumpRecording,
  exactDuration: number,
): PendingTrack[] => [
  {
    ...exactTrack(recording, 0, exactDuration + 2.5),
    token: 'fake-lrclib-length-miss',
  },
  {
    ...exactTrack(recording, 0, exactDuration),
    title: `${recording.title} (Live)`,
    token: 'fake-lrclib-live-miss',
  },
  {
    ...exactTrack(recording, 0, exactDuration),
    title: `${recording.title} (Remix)`,
    token: 'fake-lrclib-remix-miss',
  },
];

// Two tracks no Recording can confidently take: same title, artist and
// length, but neither on the Recording's album.
const tiePair = (recording: FakeDumpRecording, duration: number) =>
  ['Fake Tie Album Alpha', 'Fake Tie Album Beta'].map(
    (album, albumIndex): PendingTrack => ({
      ...exactTrack(recording, 0, duration),
      album,
      token: `fake-lrclib-tie-${albumIndex}`,
    }),
  );

/**
 * Writes an SQLite file in the real LRCLIB schema from the given Recordings,
 * with placeholder plain and synced Lyrics. Deterministic: the same
 * Recordings always produce the same file, so the e2e fixture served over
 * HTTP and the tiny-mode dump carry the same near-misses. The second
 * Recording gets no exact row on purpose (only an album tie that must not
 * match), and a Recording without a length gets no row at all.
 */
export const writeFakeLrclibDump = (
  path: string,
  recordings: readonly FakeDumpRecording[],
): void => {
  const random = mulberry32(FAKE_LRCLIB_SEED);
  const tracks: PendingTrack[] = [];
  recordings.forEach((recording, index) => {
    if (index === 1) {
      tracks.push(
        ...tiePair(recording, (recording.lengthMs ?? 180_000) / 1000),
      );
      return;
    }
    if (recording.lengthMs === null) {
      return;
    }
    const duration = recording.lengthMs / 1000 + (random() * 0.5 - 0.25);
    tracks.push({ ...exactTrack(recording, index, duration) });
    if (index === 0) {
      tracks.push(...nearMisses(recording, duration));
    }
  });
  writeLrclibDump(
    path,
    tracks.map(
      (track): DumpTrack => ({
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        plain: plainLyrics(track),
        synced: syncedLyrics(track),
        source: 'fake',
      }),
    ),
  );
};
