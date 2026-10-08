import { Injectable } from '@nestjs/common';
import type {
  Album,
  AlbumTracksPage,
  CursorPaginationQuery,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { TracksService } from '../tracks/tracks.service.js';
import {
  decodeAlbumTrackCursor,
  encodeAlbumTrackCursor,
} from './album-track-cursor.js';
import { AlbumsRepository } from './albums.repository.js';

@Injectable()
export class AlbumsService {
  constructor(
    private readonly albumsRepository: AlbumsRepository,
    private readonly tracksService: TracksService,
  ) {}

  /**
   * The Album header detail. Unknown IDs fall back to the legacy map: a hit
   * answers `RESOURCE_MOVED` with the new ID (the web's proxy turns it into a
   * 308), a miss is a real 404 (an album never reprocessed has no redirect).
   * Reads never touch the Music catalog.
   */
  async getAlbum(id: string): Promise<Album> {
    const album = await this.albumsRepository.findAlbumById(id);
    if (album) {
      return album;
    }
    return this.throwMovedOrMissing(id);
  }

  /**
   * One cursor page of the Album's processed Tracks, in album order (disc,
   * then track position). Legacy IDs answer `RESOURCE_MOVED` like the header
   * does, so the web redirects instead of listing; an unknown ID is a real
   * 404. The catalog details come from the tracks module. Reads never touch
   * the Music catalog.
   */
  async getAlbumTracks(
    id: string,
    query: CursorPaginationQuery,
  ): Promise<AlbumTracksPage> {
    if (!(await this.albumsRepository.findAlbumExists(id))) {
      await this.throwMovedOrMissing(id);
    }
    const cursor = query.cursor
      ? decodeAlbumTrackCursor(query.cursor)
      : undefined;
    const page = await this.albumsRepository.findTracksByAlbumId(id, {
      cursor,
      limit: query.limit,
    });
    const details = await this.tracksService.getCatalogTracks(
      page.placements.map((placement) => placement.trackId),
    );
    const byId = new Map(details.map((track) => [track.id, track]));
    return {
      items: page.placements.flatMap((placement) => {
        const track = byId.get(placement.trackId);
        if (!track) {
          return [];
        }
        return [
          {
            ...track,
            disc: {
              position: placement.discPosition,
              title: placement.discTitle,
            },
          },
        ];
      }),
      nextCursor: page.nextCursor
        ? encodeAlbumTrackCursor(page.nextCursor)
        : null,
    };
  }

  /**
   * The redirect or the real 404 for an ID that is not a current album: a
   * legacy ID that was reprocessed answers `RESOURCE_MOVED` with its new ID.
   */
  private async throwMovedOrMissing(id: string): Promise<never> {
    const newId = await this.albumsRepository.findAlbumIdByLegacyId(id);
    if (newId) {
      throw new AppException('RESOURCE_MOVED', 'Album moved', { id: newId });
    }
    throw new AppException('NOT_FOUND', 'Album not found');
  }
}
