import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';
import {
  artist,
  artistAlias,
  artistCredit,
  artistCreditName,
  artistTag,
} from '../../database/schema/musicbrainz/artist.js';
import {
  recording,
  recordingTag,
} from '../../database/schema/musicbrainz/recording.js';
import {
  medium,
  release,
  releaseGroupTag,
  track,
} from '../../database/schema/musicbrainz/release.js';
import { genre, tag } from '../../database/schema/musicbrainz/tag.js';
import {
  lRecordingWork,
  work,
} from '../../database/schema/musicbrainz/work.js';
import type {
  ArtistNameRow,
  CreditGenreRow,
  DocumentRecordingRow,
  RecordingGenreRow,
  RecordingTitleRow,
} from './recording-document-data.js';

// The Recording's own row with the printed name of its artist credit, read
// the same way whether a batch is walked in order or synced by id.
const documentColumns = {
  id: recording.id,
  mbid: recording.gid,
  title: recording.name,
  disambiguation: recording.comment,
  artistCreditId: recording.artistCredit,
  artistCreditName: artistCredit.name,
};

/**
 * Reads the Recordings the worker indexes, a batch at a time. Read-only: the
 * tables belong to mbslave. Every method takes the ids of a whole batch and
 * runs one query for it, so indexing costs a handful of queries per batch and
 * not per Recording.
 */
export class RecordingDocumentRepository {
  private readonly getDb: () => Database;

  constructor(db: DatabaseSource) {
    this.getDb = typeof db === 'function' ? db : () => db;
  }

  /** The next `limit` Recordings after `afterId`, in id order. */
  findBatch(afterId: number, limit: number): Promise<DocumentRecordingRow[]> {
    return this.getDb()
      .select(documentColumns)
      .from(recording)
      .innerJoin(artistCredit, eq(artistCredit.id, recording.artistCredit))
      .where(gt(recording.id, afterId))
      .orderBy(asc(recording.id))
      .limit(limit);
  }

  /**
   * How many Recordings the catalog holds. The worker reads it once per
   * indexing run to log its progress against; batches never re-read it.
   */
  async countAll(): Promise<number> {
    const [row] = await this.getDb().select({ value: count() }).from(recording);
    return row?.value ?? 0;
  }

  /** The Recordings with these integer ids, in no particular order. */
  async findByIds(ids: readonly number[]): Promise<DocumentRecordingRow[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.getDb()
      .select(documentColumns)
      .from(recording)
      .innerJoin(artistCredit, eq(artistCredit.id, recording.artistCredit))
      .where(inArray(recording.id, [...ids]));
  }

  /** Each credited artist with each of its aliases (once without aliases). */
  findArtistNames(artistCreditIds: number[]): Promise<ArtistNameRow[]> {
    return this.getDb()
      .selectDistinct({
        artistCreditId: artistCreditName.artistCredit,
        name: artist.name,
        sortName: artist.sortName,
        aliasName: artistAlias.name,
        aliasSortName: artistAlias.sortName,
      })
      .from(artistCreditName)
      .innerJoin(artist, eq(artist.id, artistCreditName.artist))
      .leftJoin(artistAlias, eq(artistAlias.artist, artist.id))
      .where(inArray(artistCreditName.artistCredit, artistCreditIds));
  }

  findReleaseTitles(recordingIds: number[]): Promise<RecordingTitleRow[]> {
    return this.getDb()
      .selectDistinct({ recordingId: track.recording, title: release.name })
      .from(track)
      .innerJoin(medium, eq(medium.id, track.medium))
      .innerJoin(release, eq(release.id, medium.release))
      .where(inArray(track.recording, recordingIds));
  }

  findWorkTitles(recordingIds: number[]): Promise<RecordingTitleRow[]> {
    return this.getDb()
      .selectDistinct({
        recordingId: lRecordingWork.entity0,
        title: work.name,
      })
      .from(lRecordingWork)
      .innerJoin(work, eq(work.id, lRecordingWork.entity1))
      .where(inArray(lRecordingWork.entity0, recordingIds));
  }

  /** The genres (only) the Recordings' own tags give them. */
  findRecordingGenres(recordingIds: number[]): Promise<RecordingGenreRow[]> {
    return this.getDb()
      .select({
        recordingId: recordingTag.recording,
        name: tag.name,
        count: recordingTag.count,
        genreMbid: genre.gid,
      })
      .from(recordingTag)
      .innerJoin(tag, eq(tag.id, recordingTag.tag))
      .innerJoin(genre, eq(genre.name, tag.name))
      .where(
        and(
          inArray(recordingTag.recording, recordingIds),
          gt(recordingTag.count, 0),
        ),
      );
  }

  /**
   * The genres of the release groups each Recording is on, votes added up
   * per genre. Each release group counts once per Recording, however many of
   * its releases carry it.
   */
  findReleaseGroupGenres(recordingIds: number[]): Promise<RecordingGenreRow[]> {
    const groups = this.getDb()
      .selectDistinct({
        recordingId: track.recording,
        releaseGroupId: release.releaseGroup,
      })
      .from(track)
      .innerJoin(medium, eq(medium.id, track.medium))
      .innerJoin(release, eq(release.id, medium.release))
      .where(inArray(track.recording, recordingIds))
      .as('groups');
    const votes = sql<number>`sum(${releaseGroupTag.count})::int`;
    return this.getDb()
      .select({
        recordingId: groups.recordingId,
        name: tag.name,
        count: votes,
        genreMbid: genre.gid,
      })
      .from(groups)
      .innerJoin(
        releaseGroupTag,
        eq(releaseGroupTag.releaseGroup, groups.releaseGroupId),
      )
      .innerJoin(tag, eq(tag.id, releaseGroupTag.tag))
      .innerJoin(genre, eq(genre.name, tag.name))
      .groupBy(groups.recordingId, tag.name, genre.gid)
      .having(gt(votes, 0));
  }

  /** The genres of the credited artists, votes added up per genre. */
  findArtistGenres(artistCreditIds: number[]): Promise<CreditGenreRow[]> {
    const votes = sql<number>`sum(${artistTag.count})::int`;
    return this.getDb()
      .select({
        artistCreditId: artistCreditName.artistCredit,
        name: tag.name,
        count: votes,
        genreMbid: genre.gid,
      })
      .from(artistCreditName)
      .innerJoin(artistTag, eq(artistTag.artist, artistCreditName.artist))
      .innerJoin(tag, eq(tag.id, artistTag.tag))
      .innerJoin(genre, eq(genre.name, tag.name))
      .where(inArray(artistCreditName.artistCredit, artistCreditIds))
      .groupBy(artistCreditName.artistCredit, tag.name, genre.gid)
      .having(gt(votes, 0));
  }
}
