import { Injectable } from '@nestjs/common';
import type { PublicProfile } from '@notefinder/contracts';
import { AttemptsService } from '../attempts/attempts.service.js';
import { UserProfileService } from '../users/user-profile.service.js';

/**
 * The public banner a visitor sees: the Profile fields plus the three chips,
 * always present and `null` when the User has nothing to show for one (no
 * Daily target, no qualifying Vocal range, no valid Most sung artist).
 */
@Injectable()
export class PublicProfileService {
  constructor(
    private readonly userProfiles: UserProfileService,
    private readonly attempts: AttemptsService,
  ) {}

  /** Usernames are case-insensitive; an unknown one is `NOT_FOUND`. */
  async getPublicProfile(username: string): Promise<PublicProfile> {
    const { userId, profile } =
      await this.userProfiles.findPublicProfile(username);
    const { vocalRange, mostSungArtist } =
      await this.attempts.profileChips(userId);
    return {
      ...profile,
      dailyPracticeTargetSeconds: profile.dailyPracticeTargetSeconds ?? null,
      vocalRange,
      mostSungArtist,
    };
  }
}
