import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  albumArtists,
  albumDiscs,
  albums,
  albumTracks,
} from '../../database/schema/albums.js';
import { artists, trackArtists } from '../../database/schema/artists.js';
import { tracks } from '../../database/schema/tracks.js';
import type { AlbumDisc, AlbumPlacement } from './track-metadata-placement.js';

/** An Artist as the import writes it: its MBID, name and genres. */
export type ArtistRecord = { mbid: string; name: string; genres: string[] };

/** An Album header as the import writes it (the release group's fields). */
export type AlbumRecord = {
  mbid: string;
  title: string;
  primaryType: string | null;
  secondaryTypes: string[];
  year: number | null;
  genres: string[];
};

/** The Album's ID, and whether its cover is already stored. */
export type AlbumHeader = { id: string; hasCover: boolean };

/** The row an insert that returns exactly one row answers with. */
const firstRow = <TRow>(rows: readonly TRow[]): TRow => {
  const [row] = rows;
  if (row === undefined) {
    throw new Error('Insert returned no row');
  }
  return row;
};

/**
 * The rows a Track's metadata import writes: Artists, Albums and the links
 * between them and the Track. Every write upserts or replaces its own rows,
 * so an import repeated after a failure lands on the same rows.
 */
@Injectable()
export class TrackMetadataRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** The MBID of the Recording a Track was created from; undefined for an unknown Track. */
  async findRecordingMbid(trackId: string): Promise<string | undefined> {
    const [row] = await this.txHost.tx
      .select({ recordingMbid: tracks.recordingMbid })
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1);
    return row?.recordingMbid;
  }

  /** Upserts an Artist by its MBID; answers its ID. */
  async upsertArtist(artist: ArtistRecord): Promise<string> {
    const rows = await this.txHost.tx
      .insert(artists)
      .values(artist)
      .onConflictDoUpdate({
        target: artists.mbid,
        set: { name: artist.name, genres: artist.genres },
      })
      .returning({ id: artists.id });
    return firstRow(rows).id;
  }

  /** Links the Track to its credited Artists; a link that exists stays as it is. */
  async linkTrackArtists(trackId: string, artistIds: string[]): Promise<void> {
    if (artistIds.length === 0) {
      return;
    }
    await this.txHost.tx
      .insert(trackArtists)
      .values(artistIds.map((artistId) => ({ trackId, artistId })))
      .onConflictDoNothing();
  }

  /**
   * Upserts an Album header by its release group MBID. The cover is not part
   * of the header write, so a stored cover survives a re-run.
   */
  async upsertAlbum(album: AlbumRecord): Promise<AlbumHeader> {
    const rows = await this.txHost.tx
      .insert(albums)
      .values({ ...album, coverArtUrl: null })
      .onConflictDoUpdate({
        target: albums.mbid,
        set: {
          title: album.title,
          primaryType: album.primaryType,
          secondaryTypes: album.secondaryTypes,
          year: album.year,
          genres: album.genres,
        },
      })
      .returning({ id: albums.id, coverArtUrl: albums.coverArtUrl });
    const row = firstRow(rows);
    return { id: row.id, hasCover: row.coverArtUrl !== null };
  }

  /** Records the public URL of the Album's cover, once it is stored. */
  async setAlbumCoverUrl(albumId: string, coverArtUrl: string): Promise<void> {
    await this.txHost.tx
      .update(albums)
      .set({ coverArtUrl })
      .where(eq(albums.id, albumId));
  }

  /** Replaces the Album's credit with these Artists, in credit order. */
  async replaceAlbumArtists(
    albumId: string,
    artistIds: string[],
  ): Promise<void> {
    await this.txHost.tx
      .delete(albumArtists)
      .where(eq(albumArtists.albumId, albumId));
    if (artistIds.length === 0) {
      return;
    }
    await this.txHost.tx.insert(albumArtists).values(
      artistIds.map((artistId, position) => ({
        albumId,
        artistId,
        position,
      })),
    );
  }

  /**
   * Upserts the Album's discs by position. A disc's name follows the latest
   * answer, and discs no import names are left alone (other Tracks sit on them).
   */
  async upsertAlbumDiscs(albumId: string, discs: AlbumDisc[]): Promise<void> {
    for (const disc of discs) {
      await this.txHost.tx
        .insert(albumDiscs)
        .values({ albumId, position: disc.position, title: disc.title })
        .onConflictDoUpdate({
          target: [albumDiscs.albumId, albumDiscs.position],
          set: { title: disc.title },
        });
    }
  }

  /**
   * Places the Track on the Album. One link per (Album, Track): a placement
   * that changed is updated in place.
   */
  async upsertAlbumTrack(
    albumId: string,
    trackId: string,
    placement: AlbumPlacement,
  ): Promise<void> {
    await this.txHost.tx
      .insert(albumTracks)
      .values({ albumId, trackId, ...placement })
      .onConflictDoUpdate({
        target: [albumTracks.albumId, albumTracks.trackId],
        set: {
          discPosition: placement.discPosition,
          trackPosition: placement.trackPosition,
        },
      });
  }
}
