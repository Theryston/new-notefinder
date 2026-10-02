import { asc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';
import {
  artistCredit,
  artistCreditName,
} from '../../database/schema/musicbrainz/artist.js';
import { recording } from '../../database/schema/musicbrainz/recording.js';
import {
  medium,
  release,
  track,
} from '../../database/schema/musicbrainz/release.js';
import { recordingLyrics } from '../../database/schema/recording-lyrics.js';

/** A Recording with what the Lyrics match compares. */
export type MatchingRecording = {
  /** MusicBrainz's integer id, the order the import walks in. */
  id: number;
  mbid: string;
  title: string;
  lengthMs: number | null;
  /** The printed artist credit. */
  artistCredit: string;
  /** The name of every credited artist. */
  artistNames: string[];
  /** The titles of the releases it is on. */
  albumTitles: string[];
};

/** Matched Lyrics to keep, by the Recording's MBID. */
export type LyricsInsert = {
  mbid: string;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

/** A Recording's Lyrics with the id the import and indexing walk by. */
export type LyricsDocumentRow = {
  recordingId: number;
  mbid: string;
  plain: string | null;
  synced: string | null;
};

/** Kept Lyrics as the reimport carries them, in MBID order. */
export type KeptLyricsRow = {
  mbid: string;
  plain: string | null;
  synced: string | null;
};

// Postgres caps the parameters of one statement; Lyrics are saved in chunks
// below it.
const SAVE_CHUNK = 500;

/**
 * Reads the Recordings for Lyrics matching and keeps the matched Lyrics.
 * Read-only on the MusicBrainz tables (they belong to mbslave); the writes
 * go to our own `recording_lyrics`.
 */
export class LyricsRepository {
  private readonly getDb: () => Database;

  constructor(db: DatabaseSource) {
    this.getDb = typeof db === 'function' ? db : () => db;
  }

  /** The next `limit` Recordings after `afterId`, with their match data. */
  async findMatchBatch(
    afterId: number,
    limit: number,
  ): Promise<MatchingRecording[]> {
    const rows = await this.getDb()
      .select({
        id: recording.id,
        mbid: recording.gid,
        title: recording.name,
        lengthMs: recording.length,
        artistCreditId: recording.artistCredit,
        artistCredit: artistCredit.name,
      })
      .from(recording)
      .innerJoin(artistCredit, eq(artistCredit.id, recording.artistCredit))
      .where(gt(recording.id, afterId))
      .orderBy(asc(recording.id))
      .limit(limit);
    return this.withMatchData(rows);
  }

  /** The given Recordings with their match data, in no particular order. */
  async findMatchingByIds(ids: number[]): Promise<MatchingRecording[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.getDb()
      .select({
        id: recording.id,
        mbid: recording.gid,
        title: recording.name,
        lengthMs: recording.length,
        artistCreditId: recording.artistCredit,
        artistCredit: artistCredit.name,
      })
      .from(recording)
      .innerJoin(artistCredit, eq(artistCredit.id, recording.artistCredit))
      .where(inArray(recording.id, ids));
    return this.withMatchData(rows);
  }

  /** The kept Lyrics of one Recording, undefined when none matched. */
  async findByMbid(
    mbid: string,
  ): Promise<{ plain: string | null; synced: string | null } | undefined> {
    const [row] = await this.getDb()
      .select({
        plain: recordingLyrics.plainLyrics,
        synced: recordingLyrics.syncedLyrics,
      })
      .from(recordingLyrics)
      .where(eq(recordingLyrics.mbid, mbid))
      .limit(1);
    return row;
  }

  /** The kept Lyrics of the given Recordings, by MBID. */
  async findKeptByMbids(
    mbids: string[],
  ): Promise<Map<string, { plain: string | null; synced: string | null }>> {
    if (mbids.length === 0) {
      return new Map();
    }
    const rows = await this.getDb()
      .select({
        mbid: recordingLyrics.mbid,
        plain: recordingLyrics.plainLyrics,
        synced: recordingLyrics.syncedLyrics,
      })
      .from(recordingLyrics)
      .where(inArray(recordingLyrics.mbid, mbids));
    return new Map(
      rows.map((row) => [row.mbid, { plain: row.plain, synced: row.synced }]),
    );
  }

  /** The kept Lyrics of the next `limit` Recordings after `afterId`. */
  async findLyricsDocuments(
    afterId: number,
    limit: number,
  ): Promise<LyricsDocumentRow[]> {
    return (
      this.getDb()
        .select({
          recordingId: recording.id,
          mbid: recordingLyrics.mbid,
          plain: recordingLyrics.plainLyrics,
          synced: recordingLyrics.syncedLyrics,
        })
        .from(recordingLyrics)
        // `gid` is a uuid column and `mbid` text: compared as text.
        .innerJoin(
          recording,
          sql`${recording.gid}::text = ${recordingLyrics.mbid}`,
        )
        .where(gt(recording.id, afterId))
        .orderBy(asc(recording.id))
        .limit(limit)
    );
  }

  /** Keeps the matched Lyrics, replacing a Recording's earlier match. */
  async saveLyrics(rows: readonly LyricsInsert[]): Promise<void> {
    for (let at = 0; at < rows.length; at += SAVE_CHUNK) {
      await this.getDb()
        .insert(recordingLyrics)
        .values(rows.slice(at, at + SAVE_CHUNK))
        .onConflictDoUpdate({
          target: recordingLyrics.mbid,
          set: {
            plainLyrics: sql`excluded.plain_lyrics`,
            syncedLyrics: sql`excluded.synced_lyrics`,
            updatedAt: new Date(),
          },
        });
    }
  }

  /** Forgets the kept Lyrics of the given Recordings. */
  async deleteLyrics(mbids: string[]): Promise<void> {
    return this.deleteKeptByMbids(mbids);
  }

  /** Drops the kept Lyrics of Recordings that lost their match. */
  async deleteKeptByMbids(mbids: readonly string[]): Promise<void> {
    if (mbids.length === 0) {
      return;
    }
    await this.getDb()
      .delete(recordingLyrics)
      .where(inArray(recordingLyrics.mbid, [...mbids]));
  }

  private async withMatchData(
    rows: {
      id: number;
      mbid: string;
      title: string;
      lengthMs: number | null;
      artistCreditId: number;
      artistCredit: string;
    }[],
  ): Promise<MatchingRecording[]> {
    if (rows.length === 0) {
      return [];
    }
    const creditIds = [...new Set(rows.map((row) => row.artistCreditId))];
    const recordingIds = rows.map((row) => row.id);
    const [names, albums] = await Promise.all([
      this.findArtistNames(creditIds),
      this.findAlbumTitles(recordingIds),
    ]);
    return rows.map((row) => ({
      id: row.id,
      mbid: row.mbid,
      title: row.title,
      lengthMs: row.lengthMs,
      artistCredit: row.artistCredit,
      artistNames: names.get(row.artistCreditId) ?? [],
      albumTitles: albums.get(row.id) ?? [],
    }));
  }

  /**
   * The kept Lyrics of the next `limit` MBIDs after `afterMbid` (MBID order,
   * which is the only order `recording_lyrics` has). The reimport carries
   * them to the parallel copy in chunks, so millions of kept Lyrics never
   * sit in memory at once.
   */
  async findKeptBatch(
    afterMbid: string,
    limit: number,
  ): Promise<KeptLyricsRow[]> {
    return this.getDb()
      .select({
        mbid: recordingLyrics.mbid,
        plain: recordingLyrics.plainLyrics,
        synced: recordingLyrics.syncedLyrics,
      })
      .from(recordingLyrics)
      .where(gt(recordingLyrics.mbid, afterMbid))
      .orderBy(asc(recordingLyrics.mbid))
      .limit(limit);
  }

  /**
   * The match data of the Recordings with these MBIDs, for revalidating
   * carried Lyrics against the parallel copy. An MBID missing from this
   * copy (a deleted or merged Recording) simply has no row.
   */
  async findMatchRecordingsByMbids(
    mbids: readonly string[],
  ): Promise<MatchingRecording[]> {
    if (mbids.length === 0) {
      return [];
    }
    const rows = await this.getDb()
      .select({
        id: recording.id,
        mbid: recording.gid,
        title: recording.name,
        lengthMs: recording.length,
        artistCreditId: recording.artistCredit,
        artistCredit: artistCredit.name,
      })
      .from(recording)
      .innerJoin(artistCredit, eq(artistCredit.id, recording.artistCredit))
      // `gid` is a uuid column and the MBIDs text: compared as text.
      .where(inArray(sql`${recording.gid}::text`, [...mbids]));
    return this.withMatchData(rows);
  private async findArtistNames(
    creditIds: number[],
  ): Promise<Map<number, string[]>> {
    const rows = await this.getDb()
      .select({
        creditId: artistCreditName.artistCredit,
        name: artistCreditName.name,
      })
      .from(artistCreditName)
      .where(inArray(artistCreditName.artistCredit, creditIds))
      .orderBy(asc(artistCreditName.position));
    const names = new Map<number, string[]>();
    for (const row of rows) {
      const list = names.get(row.creditId) ?? [];
      list.push(row.name);
      names.set(row.creditId, list);
    }
    return names;
  }

  private async findAlbumTitles(
    recordingIds: number[],
  ): Promise<Map<number, string[]>> {
    const rows = await this.getDb()
      .selectDistinct({ recordingId: track.recording, title: release.name })
      .from(track)
      .innerJoin(medium, eq(medium.id, track.medium))
      .innerJoin(release, eq(release.id, medium.release))
      .where(inArray(track.recording, recordingIds));
    const titles = new Map<number, string[]>();
    for (const row of rows) {
      const list = titles.get(row.recordingId) ?? [];
      list.push(row.title);
      titles.set(row.recordingId, list);
    }
    return titles;
  }
}
