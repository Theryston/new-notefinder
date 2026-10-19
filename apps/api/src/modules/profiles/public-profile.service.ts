import { Injectable } from '@nestjs/common';
import type { PublicProfile } from '@notefinder/contracts';
import { AttemptsService } from '../attempts/attempts.service.js';
import { FollowsService } from '../follows/follows.service.js';
import { UserProfileService } from '../users/user-profile.service.js';

/**
 * The public banner a visitor sees: the Profile fields, the three chips
 * (always present, `null` when the User has nothing to show for one: no Daily
 * target, no qualifying Vocal range, no valid Most sung artist) and the
 * follow counts.
 */
@Injectable()
export class PublicProfileService {
  constructor(
    private readonly userProfiles: UserProfileService,
    private readonly attempts: AttemptsService,
    private readonly follows: FollowsService,
  ) {}

  /** Usernames are case-insensitive; an unknown one is `NOT_FOUND`. */
  async getPublicProfile(username: string): Promise<PublicProfile> {
    const { userId, profile } =
      await this.userProfiles.findPublicProfile(username);
    const { vocalRange, mostSungArtist } =
      await this.attempts.profileChips(userId);
    const counts = await this.follows.countsOf(userId);
    return {
      ...profile,
      dailyPracticeTargetSeconds: profile.dailyPracticeTargetSeconds ?? null,
      vocalRange,
      mostSungArtist,
      followersCount: counts.followers,
      followingCount: counts.following,
      friendsCount: counts.friends,
    };
  }
}
