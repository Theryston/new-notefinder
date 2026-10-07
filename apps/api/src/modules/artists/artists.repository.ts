import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Artist, ArtistTrack } from '@notefinder/contracts';
import { and, asc, count, eq, gt, inArray } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  artists,
  legacyArtistIds,
  trackArtists,
} from '../../database/schema/artists.js';
import { tracks } from '../../database/schema/tracks.js';

@Injectable()
export class ArtistsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * The Artist with its processed-track count, or nothing when no Artist
   * has this ID. The count comes from the artist-track links, so it is
   * zero for an Artist with no processed Tracks yet.
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
    return { ...row, trackCount: await this.countTracks(id) };
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

  private async countTracks(artistId: string): Promise<number> {
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(trackArtists)
      .where(eq(trackArtists.artistId, artistId));
    return row?.value ?? 0;
  }

  /**
   * One page of the Artist's processed Tracks in stable `id` order, one
   * entry per Recording. Keyset over the link table: the cursor is a
   * Track ID the service already decoded, `limit + 1` rows decide the
   * next cursor.
   */
  async findTracksByArtistId(
    artistId: string,
    options: { cursorTrackId?: string; limit: number },
  ): Promise<{ items: ArtistTrack[]; nextCursor: string | null }> {
    const { cursorTrackId, limit } = options;
    const conditions = cursorTrackId
      ? and(eq(trackArtists.artistId, artistId), gt(tracks.id, cursorTrackId))
      : eq(trackArtists.artistId, artistId);

    const rows = await this.txHost.tx
      .select({
        id: tracks.id,
        title: tracks.title,
        lengthMs: tracks.lengthMs,
        disambiguation: tracks.disambiguation,
        video: tracks.video,
        isrcs: tracks.isrcs,
        genres: tracks.genres,
      })
      .from(trackArtists)
      .innerJoin(tracks, eq(trackArtists.trackId, tracks.id))
      .where(conditions)
      .orderBy(asc(tracks.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    if (page.length === 0) {
      return { items: [], nextCursor: null };
    }
    const trackIds = page.map((row) => row.id);
    const creditRows = await this.txHost.tx
      .select({
        trackId: trackArtists.trackId,
        id: artists.id,
        name: artists.name,
      })
      .from(trackArtists)
      .innerJoin(artists, eq(trackArtists.artistId, artists.id))
      .where(inArray(trackArtists.trackId, trackIds))
      .orderBy(asc(artists.name));

    const byTrack = new Map<string, { id: string; name: string }[]>();
    for (const row of creditRows) {
      const list = byTrack.get(row.trackId) ?? [];
      list.push({ id: row.id, name: row.name });
      byTrack.set(row.trackId, list);
    }

    const items: ArtistTrack[] = page.map((row) => ({
      ...row,
      artists: byTrack.get(row.id) ?? [],
    }));

    const last = page[page.length - 1];
    if (!last || !hasMore) {
      return { items, nextCursor: null };
    }
    return {
      items,
      nextCursor: Buffer.from(last.id, 'utf8').toString('base64url'),
    };
  }
}
