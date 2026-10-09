import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Artist } from '@notefinder/contracts';
import { and, asc, count, eq, gt } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  artists,
  legacyArtistIds,
  trackArtists,
} from '../../database/schema/artists.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import { tracks } from '../../database/schema/tracks.js';

/** An Artist as the metadata import writes it: its MBID, name and genres. */
export type ArtistRecord = { mbid: string; name: string; genres: string[] };

@Injectable()
export class ArtistsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * The Artist with its track count, or nothing when no Artist has this ID or
   * none of its Tracks has a completed Processing: an Artist is shown only
   * once a Track of it is complete (CONTEXT.md "Processing").
   */
  async findArtistById(id: string): Promise<Artist | undefined> {
    const [row] = await this.txHost.tx
      .select({
        id: artists.id,
        mbid: artists.mbid,
        name: artists.name,
        genres: artists.genres,
      })
      .from(artists)
      .where(eq(artists.id, id))
      .limit(1);
    if (!row) {
      return undefined;
    }
    const trackCount = await this.countTracks(id);
    return trackCount > 0 ? { ...row, trackCount } : undefined;
  }

  /** The new ID a legacy artist ID points to, if it was reprocessed. */
  async findArtistIdByLegacyId(legacyId: string): Promise<string | undefined> {
    const [row] = await this.txHost.tx
      .select({ artistId: legacyArtistIds.artistId })
      .from(legacyArtistIds)
      .where(eq(legacyArtistIds.legacyId, legacyId))
      .limit(1);
    return row?.artistId;
  }

  /**
   * Upserts an Artist of the Music catalog by its MBID, with its genres; answers
   * its ID. Written by the metadata import, which may repeat it.
   */
  async upsertArtist(artist: ArtistRecord): Promise<string> {
    const rows = await this.txHost.tx
      .insert(artists)
      .values(artist)
      .onConflictDoUpdate({
        target: artists.mbid,
        set: { name: artist.name, genres: artist.genres },
      })
      .returning({ id: artists.id });
    const [row] = rows;
    if (row === undefined) {
      throw new Error('Insert returned no row');
    }
    return row.id;
  }

  /** Links a Track to its credited Artists; a link that exists stays as it is. */
  async linkTrackArtists(trackId: string, artistIds: string[]): Promise<void> {
    if (artistIds.length === 0) {
      return;
    }
    await this.txHost.tx
      .insert(trackArtists)
      .values(artistIds.map((artistId) => ({ trackId, artistId })))
      .onConflictDoNothing();
  }

  /** The Artist's Tracks that have a completed Processing. */
  private async countTracks(artistId: string): Promise<number> {
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(trackArtists)
      .where(
        and(
          eq(trackArtists.artistId, artistId),
          hasCompletedProcessing(trackArtists.trackId),
        ),
      );
    return row?.value ?? 0;
  }

  /**
   * One page of the Artist's completed Track IDs in stable `id` order. The
   * service loads the catalog details of those Tracks. Keyset over the link
   * table: the cursor is a Track ID the service already decoded, `limit + 1`
   * rows decide the next cursor.
   */
  async findTracksByArtistId(
    artistId: string,
    options: { cursorTrackId?: string; limit: number },
  ): Promise<{ trackIds: string[]; nextCursor: string | null }> {
    const { cursorTrackId, limit } = options;
    const byArtist = eq(trackArtists.artistId, artistId);
    const conditions = and(
      cursorTrackId ? and(byArtist, gt(tracks.id, cursorTrackId)) : byArtist,
      hasCompletedProcessing(tracks.id),
    );

    const rows = await this.txHost.tx
      .select({ id: tracks.id })
      .from(trackArtists)
      .innerJoin(tracks, eq(trackArtists.trackId, tracks.id))
      .where(conditions)
      .orderBy(asc(tracks.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    return {
      trackIds: page.map((row) => row.id),
      nextCursor:
        hasMore && last
          ? Buffer.from(last.id, 'utf8').toString('base64url')
          : null,
    };
  }
}
