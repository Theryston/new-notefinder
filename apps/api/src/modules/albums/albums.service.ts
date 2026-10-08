import { Injectable } from '@nestjs/common';
import type {
  Album,
  AlbumTracksPage,
  CursorPaginationQuery,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import {
  decodeAlbumTrackCursor,
  encodeAlbumTrackCursor,
} from './album-track-cursor.js';
import { AlbumsRepository } from './albums.repository.js';

@Injectable()
export class AlbumsService {
  constructor(private readonly albumsRepository: AlbumsRepository) {}

  /**
   * The Album, or the redirect/404 its ID calls for. Unknown IDs fall back
   * to the legacy map: a hit answers `RESOURCE_MOVED` with the new ID (the
   * web's proxy turns it into a 308), a miss is a real 404 (an album never
   * reprocessed has no redirect). Reads never touch the Music catalog.
   */
  private async resolveAlbumOrThrow(id: string): Promise<Album> {
    const album = await this.albumsRepository.findAlbumById(id);
    if (album) {
      return album;
    }
    const newId = await this.albumsRepository.findAlbumIdByLegacyId(id);
    if (newId) {
      throw new AppException('RESOURCE_MOVED', 'Album moved', { id: newId });
    }
    throw new AppException('NOT_FOUND', 'Album not found');
  }

  /** The Album header detail. */
  async getAlbum(id: string): Promise<Album> {
    return this.resolveAlbumOrThrow(id);
  }

  /**
   * One cursor page of the Album's processed Tracks, in album order (disc,
   * then track position). Legacy IDs answer `RESOURCE_MOVED` like the header
   * does, so the web redirects instead of listing; an unknown ID is a real
   * 404. Reads never touch the Music catalog.
   */
  async getAlbumTracks(
    id: string,
    query: CursorPaginationQuery,
  ): Promise<AlbumTracksPage> {
    await this.resolveAlbumOrThrow(id);
    const page = await this.albumsRepository.findTracksByAlbumId(id, {
      cursor: query.cursor ? decodeAlbumTrackCursor(query.cursor) : undefined,
      limit: query.limit,
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor
        ? encodeAlbumTrackCursor(page.nextCursor)
        : null,
    };
  }
}
