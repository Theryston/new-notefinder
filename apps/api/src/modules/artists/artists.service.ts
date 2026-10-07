import { Injectable } from '@nestjs/common';
import type {
  Artist,
  ArtistTracksPage,
  CursorPaginationQuery,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { ArtistsRepository } from './artists.repository.js';

const decodeTrackCursor = (cursor: string): string => {
  try {
    const id = Buffer.from(cursor, 'base64url').toString('utf8');
    // Opaque means opaque: only canonical cursors this API issued decode
    // back to themselves, so raw IDs and tampered strings 400 instead of
    // silently listing from a garbage position.
    if (
      id.length === 0 ||
      id.length > 128 ||
      Buffer.from(id, 'utf8').toString('base64url') !== cursor
    ) {
      throw new Error('Invalid cursor');
    }
    return id;
  } catch {
    throw new AppException('VALIDATION_FAILED', 'Invalid cursor');
  }
};

@Injectable()
export class ArtistsService {
  constructor(private readonly artistsRepository: ArtistsRepository) {}

  /**
   * The Artist, or the redirect/404 its ID calls for. Unknown IDs fall
   * back to the legacy map: a hit answers `RESOURCE_MOVED` with the new
   * ID (the web's proxy turns it into a 308), a miss is a real 404 (never
   * reprocessed means no redirect).
   */
  private async resolveArtistOrThrow(id: string): Promise<Artist> {
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

  /**
   * The Artist header detail. Unknown IDs fall back to the legacy map: a
   * hit answers `RESOURCE_MOVED` with the new ID (the web's proxy turns it
   * into a 308), a miss is a real 404 (never reprocessed means no redirect).
   */
  async getArtist(id: string): Promise<Artist> {
    return this.resolveArtistOrThrow(id);
  }

  /**
   * One cursor page of the Artist's processed Tracks, one entry per
   * Recording in stable `id` order. Legacy IDs answer `RESOURCE_MOVED`
   * like the header does, so the web redirects instead of listing; an
   * unknown ID is a real 404. Reads never touch the Music catalog.
   */
  async getArtistTracks(
    id: string,
    query: CursorPaginationQuery,
  ): Promise<ArtistTracksPage> {
    await this.resolveArtistOrThrow(id);
    return this.artistsRepository.findTracksByArtistId(id, {
      cursorTrackId: query.cursor ? decodeTrackCursor(query.cursor) : undefined,
      limit: query.limit,
    });
  }
}
