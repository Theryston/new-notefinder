import { Injectable } from '@nestjs/common';
import type { Artist } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { ArtistsRepository } from './artists.repository.js';

@Injectable()
export class ArtistsService {
  constructor(private readonly artistsRepository: ArtistsRepository) {}

  /**
   * The Artist header detail. Unknown IDs fall back to the legacy map: a
   * hit answers `RESOURCE_MOVED` with the new ID (the web's proxy turns it
   * into a 308), a miss is a real 404 (never reprocessed means no redirect).
   */
  async getArtist(id: string): Promise<Artist> {
    const artist = await this.artistsRepository.findArtistById(id);
    if (artist) {
      return artist;
    }
    const newId = await this.artistsRepository.findArtistIdByLegacyId(id);
    if (newId) {
      throw new AppException('RESOURCE_MOVED', 'Artist moved', { id: newId });
    }
    throw new AppException('NOT_FOUND', 'Artist not found');
  }
}
