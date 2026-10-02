import { DatabaseSync } from 'node:sqlite';
import { normalizeLyricsText } from '../../lib/normalize-text.js';

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

const CREATED_AT = '2026-01-01T00:00:00.000Z';

const CREATE_TABLES = `
  CREATE TABLE tracks (id INTEGER PRIMARY KEY, name TEXT NOT NULL,
    name_lower TEXT NOT NULL, artist_name TEXT NOT NULL,
    artist_name_lower TEXT NOT NULL, album_name TEXT NOT NULL,
    album_name_lower TEXT NOT NULL, duration FLOAT NOT NULL,
    last_lyrics_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE lyrics (id INTEGER PRIMARY KEY, track_id INTEGER NOT NULL,
    plain_lyrics TEXT, synced_lyrics TEXT, has_plain_lyrics INTEGER NOT NULL,
    has_synced_lyrics INTEGER NOT NULL, instrumental INTEGER NOT NULL,
    source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    lyricsfile TEXT, has_lyricsfile INTEGER NOT NULL);
`;

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
  const db = new DatabaseSync(path);
  try {
    db.exec(CREATE_TABLES);
    const insertTrack = db.prepare(`
      INSERT INTO tracks (name, name_lower, artist_name, artist_name_lower,
        album_name, album_name_lower, duration, last_lyrics_id,
        created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertLyrics = db.prepare(`
      INSERT INTO lyrics (track_id, plain_lyrics, synced_lyrics,
        has_plain_lyrics, has_synced_lyrics, instrumental, source,
        created_at, updated_at, lyricsfile, has_lyricsfile)
      VALUES (?, ?, ?, 1, 1, 0, 'fake', ?, ?, NULL, 0)
    `);
    for (const track of tracks) {
      const plain = plainLyrics(track);
      const synced = syncedLyrics(track);
      const trackId = Number(
        insertTrack.run(
          track.title,
          // The `_lower` columns hold the normalized spelling, the way the
          // strict match compares: pass one and pass two agree on them.
          normalizeLyricsText(track.title),
          track.artist,
          normalizeLyricsText(track.artist),
          track.album,
          normalizeLyricsText(track.album),
          track.duration,
          null,
          CREATED_AT,
          CREATED_AT,
        ).lastInsertRowid,
      );
      const lyricId = Number(
        insertLyrics.run(trackId, plain, synced, CREATED_AT, CREATED_AT)
          .lastInsertRowid,
      );
      db.prepare('UPDATE tracks SET last_lyrics_id = ? WHERE id = ?').run(
        lyricId,
        trackId,
      );
    }
  } finally {
    db.close();
  }
};
