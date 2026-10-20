import { Injectable, Logger } from '@nestjs/common';
import { cacheTags } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { UsersService } from '../users/users.service.js';
import { FollowsService } from './follows.service.js';

/**
 * Saves a follow change and tells the web to refresh the Profiles of both
 * Users, since each one shows the follow counts. The revalidation is best
 * effort: the change is already saved, so a queue that is down must not turn
 * the write into an error.
 */
@Injectable()
export class FollowWritesService {
  private readonly logger = new Logger(FollowWritesService.name);

  constructor(
    private readonly follows: FollowsService,
    private readonly users: UsersService,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  async follow(followerId: string, followedId: string): Promise<void> {
    await this.follows.follow(followerId, followedId);
    await this.revalidateProfiles(followerId, followedId);
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    await this.follows.unfollow(followerId, followedId);
    await this.revalidateProfiles(followerId, followedId);
  }

  /** Removes a follower of the signed-in User, then refreshes both Profiles. */
  async removeFollower(viewerId: string, followerId: string): Promise<void> {
    await this.follows.removeFollower(viewerId, followerId);
    await this.revalidateProfiles(viewerId, followerId);
  }

  private async revalidateProfiles(
    followerId: string,
    followedId: string,
  ): Promise<void> {
    try {
      const found = await this.users.findPublicUsers([followerId, followedId]);
      // A User without a username has no Profile, so nothing is cached for it.
      const tags = [...found.values()].flatMap((user) =>
        user.username ? [cacheTags.userProfile(user.username)] : [],
      );
      if (tags.length > 0) {
        await this.webRevalidation.revalidate(tags);
      }
    } catch (error) {
      this.logger.warn(
        `Could not enqueue the Profile revalidation: ${reasonOf(error)}`,
      );
    }
  }
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
