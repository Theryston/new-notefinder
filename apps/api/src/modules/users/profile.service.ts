import { Injectable, Logger } from '@nestjs/common';
import {
  type CurrentUser,
  cacheTags,
  type UpdateMeBody,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { UsersRepository } from './users.repository.js';

/** What a User can change about how they appear to others (`PATCH /v1/me`). */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  async updateProfile(
    userId: string,
    changes: UpdateMeBody,
  ): Promise<CurrentUser> {
    const user = await this.usersRepository.updateName(userId, changes.name);
    if (!user) {
      // The session outlived its user (deleted in between).
      throw new AppException('UNAUTHORIZED', 'User no longer exists');
    }
    if (user.username !== null) {
      await this.revalidateProfile(user.username);
    }
    return { ...user, createdAt: user.createdAt.toISOString() };
  }

  /**
   * Best effort: the change is already saved, so a queue that is down must
   * not turn it into an error (the Profile page then catches up when its
   * cache next expires or is revalidated).
   */
  private async revalidateProfile(username: string): Promise<void> {
    try {
      await this.webRevalidation.revalidate([cacheTags.userProfile(username)]);
    } catch (error) {
      this.logger.warn(
        `Could not enqueue the Profile revalidation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
