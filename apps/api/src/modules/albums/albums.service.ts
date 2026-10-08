import { Injectable } from '@nestjs/common';
import type { Album } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { AlbumsRepository } from './albums.repository.js';

@Injectable()
export class AlbumsService {
  constructor(private readonly albumsRepository: AlbumsRepository) {}

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
    const newId = await this.albumsRepository.findAlbumIdByLegacyId(id);
    if (newId) {
      throw new AppException('RESOURCE_MOVED', 'Album moved', { id: newId });
    }
    throw new AppException('NOT_FOUND', 'Album not found');
  }
}
