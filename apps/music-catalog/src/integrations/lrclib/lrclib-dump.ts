import { DatabaseSync } from 'node:sqlite';
import { assertLrclibSchema } from './lrclib-schema.js';

/** A track row of the LRCLIB dump, without its Lyrics (pass one reads no Lyrics). */
export type LrclibTrack = {
  id: number;
  title: string;
  artist: string;
  album: string;
  /** In seconds, as the dump stores it. */
  duration: number;
};

/** One row of the dump's `lyrics` table, without the columns never read. */
export type LrclibLyrics = {
  trackId: number;
  plain: string | null;
  synced: string | null;
};

export type LrclibCandidateQuery = {
  /** Simple lowercase, the way the dump's `_lower` columns are spelled. */
  titleLower: string;
  artistLower: string;
  /** In seconds: a window around the Recording's length, refined in code. */
  minDuration: number;
  maxDuration: number;
};

/**
 * An opened LRCLIB dump (real or fake): the same reads for both. Pass one
 * only touches the lightweight track metadata (`tracks`); the Lyrics text is
 * read in pass two, and only for the matched tracks.
 */
export type LrclibDump = {
  findCandidates: (query: LrclibCandidateQuery) => LrclibTrack[];
  readLyrics: (trackIds: readonly number[]) => LrclibLyrics[];
  close: () => void;
};

type TrackRow = {
  id: number;
  name: string;
  artist_name: string;
  album_name: string;
  duration: number;
};

type LyricsRow = {
  track_id: number;
  plain_lyrics: string | null;
  synced_lyrics: string | null;
};

// SQLite caps the variables of one statement (999 by default); lyrics are
// read in chunks below it.
const LYRICS_READ_CHUNK = 500;

/**
 * Opens the dump at `path` read-only and checks its schema first, so a dump
 * whose schema drifted fails here with a clear error instead of matching
 * against the wrong columns.
 */
export const openLrclibDump = (path: string): LrclibDump => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    assertLrclibSchema(db);
  } catch (error) {
    db.close();
    throw error;
  }
  const candidates = db.prepare(`
    SELECT id, name, artist_name, album_name, duration FROM tracks
    WHERE name_lower = ? AND artist_name_lower = ?
      AND duration BETWEEN ? AND ?
  `);
  const byIds = (placeholders: string) =>
    db.prepare(`
      SELECT track_id, plain_lyrics, synced_lyrics FROM lyrics
      WHERE track_id IN (${placeholders})
    `);
  return {
    findCandidates: (query) =>
      (
        candidates.all(
          query.titleLower,
          query.artistLower,
          query.minDuration,
          query.maxDuration,
        ) as TrackRow[]
      ).map((row) => ({
        id: row.id,
        title: row.name,
        artist: row.artist_name,
        album: row.album_name,
        duration: row.duration,
      })),
    readLyrics: (trackIds) => {
      const rows: LrclibLyrics[] = [];
      for (let at = 0; at < trackIds.length; at += LYRICS_READ_CHUNK) {
        const chunk = trackIds.slice(at, at + LYRICS_READ_CHUNK);
        const placeholders = chunk.map(() => '?').join(', ');
        rows.push(
          ...(byIds(placeholders).all(...chunk) as LyricsRow[]).map((row) => ({
            trackId: row.track_id,
            plain: row.plain_lyrics,
            synced: row.synced_lyrics,
          })),
        );
      }
      return rows;
    },
    close: () => {
      db.close();
    },
  };
};
