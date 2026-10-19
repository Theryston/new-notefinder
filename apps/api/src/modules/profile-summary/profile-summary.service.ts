import { Injectable } from '@nestjs/common';
import type { PublicProfileSummary } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { AttemptsService } from '../attempts/attempts.service.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { ProfileSummaryRepository } from './profile-summary.repository.js';

/**
 * The Summary section of a Profile. Each number is read by the module that
 * owns it: the streak from the streaks, the sung and favorite counts from
 * their services, and only the Contributions are counted here.
 */
@Injectable()
export class ProfileSummaryService {
  constructor(
    private readonly streaks: StreaksService,
    private readonly attempts: AttemptsService,
    private readonly favorites: FavoritesService,
    private readonly repository: ProfileSummaryRepository,
  ) {}

  /**
   * The public numbers of the User behind a username. Usernames are stored
   * lowercase, so the lookup lowercases the request. An unknown username is
   * `NOT_FOUND`; a User with no data gets zeros.
   */
  async getSummary(username: string): Promise<PublicProfileSummary> {
    const userId = await this.repository.findUserIdByUsername(
      username.toLowerCase(),
    );
    if (userId === undefined) {
      throw new AppException('NOT_FOUND', 'User not found');
    }
    const [streak, sungCount, favoritesCount, contributionsCount] =
      await Promise.all([
        // No zone: the streak is read in the one the User last practiced in.
        this.streaks.getStatus(userId, undefined),
        this.attempts.countSung(userId),
        this.favorites.countFavorites(userId),
        this.repository.countContributions(userId),
      ]);
    return {
      streakDays: streak.currentStreakDays,
      sungCount,
      favoritesCount,
      contributionsCount,
    };
  }
}
