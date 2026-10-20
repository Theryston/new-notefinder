import { Injectable } from '@nestjs/common';
import type { ProfileFollow } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { UsersService } from '../users/users.service.js';
import { FollowsRepository } from './follows.repository.js';

/**
 * Who follows whom. Every call that names another User checks that the User
 * exists, so an unknown ID is `NOT_FOUND` rather than a silent no-op.
 */
@Injectable()
export class FollowsService {
  constructor(
    private readonly follows: FollowsRepository,
    private readonly users: UsersService,
  ) {}

  /** Follows a User by ID. A follow already there changes nothing. */
  async follow(followerId: string, followedId: string): Promise<void> {
    if (followerId === followedId) {
      throw new AppException('BAD_REQUEST', 'A User cannot follow themselves');
    }
    await this.assertUserExists(followedId);
    await this.follows.add(followerId, followedId);
  }

  /** Stops following a User by ID. A User not followed changes nothing. */
  async unfollow(followerId: string, followedId: string): Promise<void> {
    await this.assertUserExists(followedId);
    await this.follows.remove(followerId, followedId);
  }

  /**
   * Removes a follower of the signed-in User. A follow that is not there
   * changes nothing. The removed User may follow again later: a removal is not
   * a block.
   */
  async removeFollower(viewerId: string, followerId: string): Promise<void> {
    await this.assertUserExists(followerId);
    await this.follows.remove(followerId, viewerId);
  }

  /** What the viewer has with the User of the Profile (`username`). */
  async profileFollow(
    viewerId: string,
    username: string,
  ): Promise<ProfileFollow> {
    const userId = await this.users.findIdByUsername(username);
    return {
      userId,
      isFollowing: await this.follows.isFollowing(viewerId, userId),
    };
  }

  private async assertUserExists(userId: string): Promise<void> {
    const found = await this.users.findPublicUsers([userId]);
    if (!found.has(userId)) {
      throw new AppException('NOT_FOUND', 'User not found');
    }
  }
}
