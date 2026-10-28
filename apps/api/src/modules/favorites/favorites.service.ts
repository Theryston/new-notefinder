import { Injectable } from '@nestjs/common';
import type { UserTrackState } from '@vozzify/contracts';
import { TracksService } from '../tracks/tracks.service.js';
import { FavoritesRepository } from './favorites.repository.js';

/**
 * A User's favorite Tracks. Every call names a Track, so a legacy Track ID
 * answers `RESOURCE_MOVED` and an unknown one `NOT_FOUND`, as every Track
 * read does.
 */
@Injectable()
export class FavoritesService {
  constructor(
    private readonly favorites: FavoritesRepository,
    private readonly tracks: TracksService,
  ) {}

  async add(userId: string, trackId: string): Promise<void> {
    await this.tracks.assertTrackExists(trackId);
    await this.favorites.add(userId, trackId);
  }

  async remove(userId: string, trackId: string): Promise<void> {
    await this.tracks.assertTrackExists(trackId);
    await this.favorites.remove(userId, trackId);
  }

  /** How many Tracks the User marked as favorites. */
  countFavorites(userId: string): Promise<number> {
    return this.favorites.countOf(userId);
  }

  async getTrackState(
    userId: string,
    trackId: string,
  ): Promise<UserTrackState> {
    await this.tracks.assertTrackExists(trackId);
    return { isFavorite: await this.favorites.isFavorite(userId, trackId) };
  }
}
