import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Album, AlbumArtist } from '@notefinder/contracts';
import { and, asc, count, eq, gt, or, type SQL } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  albumArtists,
  albumDiscs,
  albums,
  albumTracks,
  legacyAlbumIds,
} from '../../database/schema/albums.js';
import { artists } from '../../database/schema/artists.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import type { AlbumTrackCursor } from './album-track-cursor.js';

/** Where one Track sits on an Album: its ID, its position and its disc's name. */
export type AlbumPlacement = AlbumTrackCursor & { discTitle: string | null };

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

/** The cursor that resumes right after a placement of a page. */
const placementCursor = ({
  discPosition,
  trackPosition,
  trackId,
}: AlbumPlacement): AlbumTrackCursor => ({
  discPosition,
  trackPosition,
  trackId,
});

@Injectable()
export class AlbumsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * The Album with its completed-track count and its credited Artists in
   * credit order, or nothing when no Album has this ID or none of its Tracks
   * has a completed Processing (an Album is shown only once a Track of it is
   * complete). The count comes from the album-track links.
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
    const trackCount = await this.countTracks(id);
    if (trackCount === 0) {
      return undefined;
    }
    return {
      ...row,
      trackCount,
      artists: await this.findArtistCredits(id),
    };
  }

  /**
   * Whether an Album is shown: it exists and one of its Tracks has a completed
   * Processing. Answers without loading its header.
   */
  async findAlbumExists(id: string): Promise<boolean> {
    return (await this.countTracks(id)) > 0;
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
   * One page of the Album's placements in album order: the Track IDs with the
   * disc and track position each sits at. The service loads the catalog
   * details of those Tracks. `limit + 1` rows decide whether a next page
   * exists; the cursor returned is the placement that ends this page.
   */
  async findTracksByAlbumId(
    albumId: string,
    options: { cursor?: AlbumTrackCursor; limit: number },
  ): Promise<{
    placements: AlbumPlacement[];
    nextCursor: AlbumTrackCursor | null;
  }> {
    const { cursor, limit } = options;
    const rows = await this.selectPlacements(albumId, limit + 1, cursor);
    const hasMore = rows.length > limit;
    const placements = hasMore ? rows.slice(0, limit) : rows;
    const last = placements.at(-1);
    return {
      placements,
      nextCursor: hasMore && last ? placementCursor(last) : null,
    };
  }

  /**
   * The album's placements of completed Tracks after the cursor, in album
   * order, at most `take`.
   */
  private async selectPlacements(
    albumId: string,
    take: number,
    cursor: AlbumTrackCursor | undefined,
  ): Promise<AlbumPlacement[]> {
    return this.txHost.tx
      .select({
        trackId: albumTracks.trackId,
        discPosition: albumTracks.discPosition,
        trackPosition: albumTracks.trackPosition,
        discTitle: albumDiscs.title,
      })
      .from(albumTracks)
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
          hasCompletedProcessing(albumTracks.trackId),
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

  /** The album's Tracks that have a completed Processing. */
  private async countTracks(albumId: string): Promise<number> {
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(albumTracks)
      .where(
        and(
          eq(albumTracks.albumId, albumId),
          hasCompletedProcessing(albumTracks.trackId),
        ),
      );
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
