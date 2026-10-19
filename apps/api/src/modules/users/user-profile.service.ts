import { Injectable } from '@nestjs/common';
import {
  asDailyPracticeTargetSeconds,
  type PublicProfile,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { UsersRepository } from './users.repository.js';

/** A Profile's banner, with the internal ID its chips are computed from. */
export type PublicProfileLookup = {
  userId: string;
  profile: PublicProfile;
};

/**
 * The public Profile of a User, addressed by username. Only the banner
 * fields are read here: nothing a visitor may not see leaves the module.
 */
@Injectable()
export class UserProfileService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Usernames are stored lowercase, so the lookup lowercases the request
   * (any casing finds the same Profile). An unknown username is `NOT_FOUND`.
   */
  async getPublicProfile(username: string): Promise<PublicProfile> {
    return (await this.findPublicProfile(username)).profile;
  }

  /** The banner of a Profile and the ID of its User, read in one query. */
  async findPublicProfile(username: string): Promise<PublicProfileLookup> {
    const normalized = username.toLowerCase();
    const row =
      await this.usersRepository.findPublicProfileByUsername(normalized);
    if (!row) {
      throw new AppException('NOT_FOUND', 'User not found');
    }
    // The Daily target is shown only when the User picked a preset.
    const dailyTarget = asDailyPracticeTargetSeconds(
      row.dailyPracticeTargetSeconds,
    );
    return {
      userId: row.id,
      profile: {
        username: normalized,
        name: row.name,
        image: row.image,
        createdAt: row.createdAt.toISOString(),
        ...(dailyTarget === null
          ? {}
          : { dailyPracticeTargetSeconds: dailyTarget }),
      },
    };
  }
}
