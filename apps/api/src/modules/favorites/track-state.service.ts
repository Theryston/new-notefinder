import { Injectable } from '@nestjs/common';
import type { TrackPracticeState } from '@vozzify/contracts';
import { AttemptsService } from '../attempts/attempts.service.js';
import { FavoritesService } from './favorites.service.js';

/**
 * What the signed-in User has with one Track (`GET /v1/me/tracks/:trackId`):
 * the favorite plus the best saved score per difficulty. It lives beside the
 * favorites because the favorite shape ({@link FavoritesService.getTrackState})
 * never changes, while this state grows with practice.
 */
@Injectable()
export class TrackStateService {
  constructor(
    private readonly favorites: FavoritesService,
    private readonly attempts: AttemptsService,
  ) {}

  /**
   * Reads the state of a Track that exists. A legacy Track ID answers
   * `RESOURCE_MOVED` and an unknown one `NOT_FOUND`, as every Track read
   * does.
   */
  async getState(userId: string, trackId: string): Promise<TrackPracticeState> {
    const state = await this.favorites.getTrackState(userId, trackId);
    return {
      ...state,
      bestScores: await this.attempts.bestScores(userId, trackId),
    };
  }
}
