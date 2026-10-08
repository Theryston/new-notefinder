import { DatabaseSync } from 'node:sqlite';
import { normalizeLyricsText } from '../../lib/normalize-text.js';

/** One track of a dump with its Lyrics, as the real LRCLIB dump holds it. */
export type DumpTrack = {
  title: string;
  artist: string;
  album: string;
  /** In seconds. */
  duration: number;
  /** Null when LRCLIB has no text of that kind. */
  plain: string | null;
  synced: string | null;
  /** The `lyrics.source` column. */
  source: string;
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

/**
 * Writes an SQLite file in the real LRCLIB schema holding the given tracks,
 * each with its Lyrics. The `_lower` columns hold the normalized spelling,
 * the way the strict match compares, so pass one and pass two agree on them.
 */
export const writeLrclibDump = (
  path: string,
  tracks: readonly DumpTrack[],
): void => {
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
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NULL, 0)
    `);
    const linkLyrics = db.prepare(
      'UPDATE tracks SET last_lyrics_id = ? WHERE id = ?',
    );
    for (const track of tracks) {
      const trackId = Number(
        insertTrack.run(
          track.title,
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
        insertLyrics.run(
          trackId,
          track.plain,
          track.synced,
          Number(track.plain !== null),
          Number(track.synced !== null),
          track.source,
          CREATED_AT,
          CREATED_AT,
        ).lastInsertRowid,
      );
      linkLyrics.run(lyricId, trackId);
    }
  } finally {
    db.close();
  }
};
