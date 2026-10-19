import { Injectable } from '@nestjs/common';
import type { PublicProfile } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { UsersRepository } from './users.repository.js';

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
    const normalized = username.toLowerCase();
    const row =
      await this.usersRepository.findPublicProfileByUsername(normalized);
    if (!row) {
      throw new AppException('NOT_FOUND', 'User not found');
    }
    return {
      username: normalized,
      name: row.name,
      image: row.image,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
