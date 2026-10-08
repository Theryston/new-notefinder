import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Album, AlbumArtist } from '@notefinder/contracts';
import { asc, eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  albumArtists,
  albums,
  legacyAlbumIds,
} from '../../database/schema/albums.js';
import { artists } from '../../database/schema/artists.js';

@Injectable()
export class AlbumsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * The Album with its credited Artists in credit order, or nothing when no
   * Album has this ID. Two small reads: the header row, then the credits.
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
    return { ...row, artists: await this.findArtistCredits(id) };
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

  private findArtistCredits(albumId: string): Promise<AlbumArtist[]> {
    return this.txHost.tx
      .select({ id: artists.id, name: artists.name })
      .from(albumArtists)
      .innerJoin(artists, eq(albumArtists.artistId, artists.id))
      .where(eq(albumArtists.albumId, albumId))
      .orderBy(asc(albumArtists.position));
  }
}
