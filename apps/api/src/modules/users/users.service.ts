import { Injectable, Logger } from '@nestjs/common';
import {
  type CurrentUser,
  cacheTags,
  type UpdateMeBody,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { type CurrentUserRow, UsersRepository } from './users.repository.js';

const toCurrentUser = (user: CurrentUserRow): CurrentUser => ({
  ...user,
  createdAt: user.createdAt.toISOString(),
});

/** The session outlived its user (deleted in between). */
const requireUser = (user: CurrentUserRow | undefined): CurrentUserRow => {
  if (!user) {
    throw new AppException('UNAUTHORIZED', 'User no longer exists');
  }
  return user;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  /**
   * The signed-in user. Read from the database rather than the session so
   * fields changed since sign-in (username, role) are current.
   */
  async getCurrentUser(userId: string): Promise<CurrentUser> {
    return toCurrentUser(
      requireUser(await this.usersRepository.findCurrentUser(userId)),
    );
  }

  /**
   * Sets the username of a user who has none yet (`PUT /v1/me/username`). It
   * never changes once set, so a user that already has one is refused.
   * Stored lowercased, like legacy.
   */
  async setUsername(userId: string, username: string): Promise<CurrentUser> {
    const result = await this.usersRepository.setUsernameIfUnset(
      userId,
      username.toLowerCase(),
    );
    if (result.status === 'set') {
      return toCurrentUser(result.user);
    }
    if (result.status === 'taken') {
      throw new AppException('CONFLICT', 'Username is already taken');
    }
    // Nothing was updated: the user is gone (UNAUTHORIZED) or already had a
    // username.
    requireUser(await this.usersRepository.findCurrentUser(userId));
    throw new AppException('CONFLICT', 'Username is already set');
  }

  /**
   * What the user changes about how they appear to others (`PATCH /v1/me`):
   * the Name, for now. Returns the updated user.
   */
  async updateProfile(
    userId: string,
    changes: UpdateMeBody,
  ): Promise<CurrentUser> {
    const user = requireUser(
      await this.usersRepository.updateName(userId, changes.name),
    );
    if (user.username !== null) {
      await this.revalidateProfile(user.username);
    }
    return toCurrentUser(user);
  }

  /**
   * Best effort: the change is already saved, so a queue that is down must
   * not turn it into an error.
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
