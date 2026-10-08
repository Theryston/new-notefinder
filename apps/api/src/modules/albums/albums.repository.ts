import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Album, AlbumArtist, AlbumTrack } from '@notefinder/contracts';
import { and, asc, count, eq, gt, or, type SQL } from 'drizzle-orm';
import { attachCatalogTrackDetails } from '../../database/catalog-track-details.repository.js';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  albumArtists,
  albumDiscs,
  albums,
  albumTracks,
  legacyAlbumIds,
} from '../../database/schema/albums.js';
import { artists } from '../../database/schema/artists.js';
import { tracks } from '../../database/schema/tracks.js';
import type { AlbumTrackCursor } from './album-track-cursor.js';

/** Rows strictly after the cursor's entry, in (disc, track, track ID) order. */
const afterCursor = ({
  discPosition,
  trackPosition,
  trackId,
}: AlbumTrackCursor): SQL | undefined =>
  or(
    gt(albumTracks.discPosition, discPosition),
    and(
      eq(albumTracks.discPosition, discPosition),
      gt(albumTracks.trackPosition, trackPosition),
    ),
    and(
      eq(albumTracks.discPosition, discPosition),
      eq(albumTracks.trackPosition, trackPosition),
      gt(albumTracks.trackId, trackId),
    ),
  );

/** The cursor that resumes right after a placement row of a page. */
const placementCursor = (row: {
  id: string;
  discPosition: number;
  trackPosition: number;
}): AlbumTrackCursor => ({
  discPosition: row.discPosition,
  trackPosition: row.trackPosition,
  trackId: row.id,
});

@Injectable()
export class AlbumsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * The Album with its processed-track count and its credited Artists in
   * credit order, or nothing when no Album has this ID. The count comes from
   * the album-track links, so it is zero for an Album with no tracks yet.
   */
  async findAlbumById(id: string): Promise<Album | undefined> {
    const [row] = await this.txHost.tx
      .select({
        id: albums.id,
        mbid: albums.mbid,
        title: albums.title,
        primaryType: albums.primaryType,
        secondaryTypes: albums.secondaryTypes,
        year: albums.year,
        genres: albums.genres,
        coverArtUrl: albums.coverArtUrl,
      })
      .from(albums)
      .where(eq(albums.id, id))
      .limit(1);
    if (!row) {
      return undefined;
    }
    return {
      ...row,
      trackCount: await this.countTracks(id),
      artists: await this.findArtistCredits(id),
    };
  }

  /** The new ID a legacy album ID points to, if it was reprocessed. */
  async findAlbumIdByLegacyId(legacyId: string): Promise<string | undefined> {
    const [row] = await this.txHost.tx
      .select({ albumId: legacyAlbumIds.albumId })
      .from(legacyAlbumIds)
      .where(eq(legacyAlbumIds.legacyId, legacyId))
      .limit(1);
    return row?.albumId;
  }

  /**
   * One page of the Album's processed Tracks in album order, each with the
   * disc it sits on. `limit + 1` rows decide whether a next page exists; the
   * cursor it returns is the entry that ends this page.
   */
  async findTracksByAlbumId(
    albumId: string,
    options: { cursor?: AlbumTrackCursor; limit: number },
  ): Promise<{ items: AlbumTrack[]; nextCursor: AlbumTrackCursor | null }> {
    const { cursor, limit } = options;
    const rows = await this.selectPlacements(albumId, limit + 1, cursor);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = await attachCatalogTrackDetails(
      this.txHost.tx,
      page,
      (track, row) => ({
        ...track,
        disc: { position: row.discPosition, title: row.discTitle },
      }),
    );

    const last = page.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? placementCursor(last) : null,
    };
  }

  /** The album's placements after the cursor, in album order, at most `take`. */
  private async selectPlacements(
    albumId: string,
    take: number,
    cursor: AlbumTrackCursor | undefined,
  ) {
    return this.txHost.tx
      .select({
        id: tracks.id,
        title: tracks.title,
        lengthMs: tracks.lengthMs,
        disambiguation: tracks.disambiguation,
        video: tracks.video,
        isrcs: tracks.isrcs,
        genres: tracks.genres,
        discPosition: albumTracks.discPosition,
        trackPosition: albumTracks.trackPosition,
        discTitle: albumDiscs.title,
      })
      .from(albumTracks)
      .innerJoin(tracks, eq(albumTracks.trackId, tracks.id))
      .innerJoin(
        albumDiscs,
        and(
          eq(albumDiscs.albumId, albumTracks.albumId),
          eq(albumDiscs.position, albumTracks.discPosition),
        ),
      )
      .where(
        and(
          eq(albumTracks.albumId, albumId),
          cursor ? afterCursor(cursor) : undefined,
        ),
      )
      .orderBy(
        asc(albumTracks.discPosition),
        asc(albumTracks.trackPosition),
        asc(albumTracks.trackId),
      )
      .limit(take);
  }

  private async countTracks(albumId: string): Promise<number> {
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(albumTracks)
      .where(eq(albumTracks.albumId, albumId));
    return row?.value ?? 0;
  }

  private findArtistCredits(albumId: string): Promise<AlbumArtist[]> {
    return this.txHost.tx
      .select({ id: artists.id, name: artists.name })
      .from(albumArtists)
      .innerJoin(artists, eq(albumArtists.artistId, artists.id))
      .where(eq(albumArtists.albumId, albumId))
      .orderBy(asc(albumArtists.position));
  }
}
