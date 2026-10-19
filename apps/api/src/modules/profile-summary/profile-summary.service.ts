import { Injectable } from '@nestjs/common';
import type { PublicProfileSummary } from '@notefinder/contracts';
import { AttemptsService } from '../attempts/attempts.service.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { TrackContributionsService } from '../tracks/track-contributions.service.js';

/**
 * The Summary section of a Profile. Each number is read through the exported
 * service of the module that owns it, so this module never touches a table.
 */
@Injectable()
export class ProfileSummaryService {
  constructor(
    private readonly streaks: StreaksService,
    private readonly attempts: AttemptsService,
    private readonly favorites: FavoritesService,
    private readonly contributions: TrackContributionsService,
  ) {}

  /**
   * The public numbers of a User, by ID (the controller resolves the username
   * first). A User with no data gets zeros.
   */
  async getSummary(userId: string): Promise<PublicProfileSummary> {
    const [streak, sungCount, favoritesCount, contributionsCount] =
      await Promise.all([
        // No zone: the streak is read in the zone the User's own clock kept
        // (their last heartbeat), and in UTC for a User who never practiced.
        this.streaks.getStatus(userId, undefined),
        this.attempts.countSung(userId),
        this.favorites.countFavorites(userId),
        this.contributions.countOf(userId),
      ]);
    return {
      streakDays: streak.currentStreakDays,
      sungCount,
      favoritesCount,
      contributionsCount,
    };
  }
}
