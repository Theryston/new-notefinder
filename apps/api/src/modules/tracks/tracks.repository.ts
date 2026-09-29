import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  lt,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { albums } from '../../database/schema/albums.js';
import { artists } from '../../database/schema/artists.js';
import {
  thumbnails,
  trackArtists,
  trackNotes,
  tracks,
} from '../../database/schema/tracks.js';
import type { TrackKey } from './track-cursor.js';

/** Whose tracks to list: an artist's or an album's. */
export type TrackOwner = { artistId: string } | { albumId: string };

export type TrackListRow = TrackKey & {
  title: string | null;
  durationSeconds: number | null;
  albumId: string | null;
  albumName: string | null;
};

export type TrackArtistRow = { trackId: string; id: string; name: string };

export type ThumbnailRow = {
  trackId: string;
  url: string;
  width: number | null;
  height: number | null;
};

export type NoteRow = { trackId: string; note: string; octave: number };

export type VocalRangeRows = { lowest: NoteRow[]; highest: NoteRow[] };

@Injectable()
export class TracksRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * Up to `limit` completed tracks of `owner` after `after`, in catalog
   * order: most popular first, newest first among ties.
   */
  listCompleted(
    owner: TrackOwner,
    { after, limit }: { after?: TrackKey; limit: number },
  ): Promise<TrackListRow[]> {
    return this.txHost.tx
      .select({
        id: tracks.id,
        score: tracks.score,
        createdAt: sql<string>`${tracks.createdAt}::text`,
        title: tracks.title,
        durationSeconds: tracks.durationSeconds,
        albumId: albums.id,
        albumName: albums.name,
      })
      .from(tracks)
      .leftJoin(albums, eq(albums.id, tracks.albumId))
      .where(and(this.completedOf(owner), after && this.isAfter(after)))
      .orderBy(desc(tracks.score), desc(tracks.createdAt), desc(tracks.id))
      .limit(limit);
  }

  async countCompleted(owner: TrackOwner): Promise<number> {
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(tracks)
      .where(this.completedOf(owner));
    return row?.value ?? 0;
  }

  /** The artists of each track, in the order they were linked. */
  findArtists(trackIds: string[]): Promise<TrackArtistRow[]> {
    return this.txHost.tx
      .select({
        trackId: trackArtists.trackId,
        id: artists.id,
        name: artists.name,
      })
      .from(trackArtists)
      .innerJoin(artists, eq(artists.id, trackArtists.artistId))
      .where(inArray(trackArtists.trackId, trackIds))
      .orderBy(asc(trackArtists.createdAt), asc(trackArtists.id));
  }

  /** Every size of each track's cover art, smallest first. */
  findThumbnails(trackIds: string[]): Promise<ThumbnailRow[]> {
    return this.txHost.tx
      .select({
        trackId: thumbnails.trackId,
        url: thumbnails.url,
        width: thumbnails.width,
        height: thumbnails.height,
      })
      .from(thumbnails)
      .where(inArray(thumbnails.trackId, trackIds))
      .orderBy(asc(thumbnails.width), asc(thumbnails.id));
  }

  /**
   * The lowest and highest note of each track, by mean frequency. Tracks
   * without notes are absent from both lists.
   */
  async findVocalRanges(trackIds: string[]): Promise<VocalRangeRows> {
    const [lowest, highest] = await Promise.all([
      this.findExtremeNotes(trackIds, asc(trackNotes.frequencyMean)),
      this.findExtremeNotes(trackIds, desc(trackNotes.frequencyMean)),
    ]);
    return { lowest, highest };
  }

  private findExtremeNotes(trackIds: string[], order: SQL): Promise<NoteRow[]> {
    return this.txHost.tx
      .selectDistinctOn([trackNotes.trackId], {
        trackId: trackNotes.trackId,
        note: trackNotes.note,
        octave: trackNotes.octave,
      })
      .from(trackNotes)
      .where(inArray(trackNotes.trackId, trackIds))
      .orderBy(trackNotes.trackId, order);
  }

  private completedOf(owner: TrackOwner): SQL | undefined {
    const ownedBy =
      'albumId' in owner
        ? eq(tracks.albumId, owner.albumId)
        : exists(
            this.txHost.tx
              .select({ one: sql`1` })
              .from(trackArtists)
              .where(
                and(
                  eq(trackArtists.trackId, tracks.id),
                  eq(trackArtists.artistId, owner.artistId),
                ),
              ),
          );
    return and(eq(tracks.status, 'COMPLETED'), ownedBy);
  }

  /** Rows strictly after `key` in `score desc, createdAt desc, id desc`. */
  private isAfter({ score, createdAt, id }: TrackKey): SQL | undefined {
    const sameScore = eq(tracks.score, score);
    const sameTime = sql`${tracks.createdAt} = ${createdAt}::timestamptz`;
    return or(
      lt(tracks.score, score),
      and(sameScore, sql`${tracks.createdAt} < ${createdAt}::timestamptz`),
      and(sameScore, sameTime, lt(tracks.id, id)),
    );
  }
}
