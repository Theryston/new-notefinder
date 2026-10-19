import { Injectable } from '@nestjs/common';
import type { PublicProfile } from '@notefinder/contracts';
import { AttemptsService } from '../attempts/attempts.service.js';
import { UserProfileService } from '../users/user-profile.service.js';

/**
 * The public banner a visitor sees: the Profile fields plus the three chips
 * the User's own practice decides (Vocal range, Most sung artist and, from
 * the profile, the Daily target). A chip with nothing to show is left out
 * of the response rather than sent as null.
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
      ...(vocalRange === null ? {} : { vocalRange }),
      ...(mostSungArtist === null ? {} : { mostSungArtist }),
    };
  }
}
