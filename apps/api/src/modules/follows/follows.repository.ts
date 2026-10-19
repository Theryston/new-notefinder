import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, count, eq, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DatabaseAdapter } from '../../database/database.js';
import { userFollows } from '../../database/schema/user-follows.js';

/** The three follow numbers of a User. */
export type FollowCounts = {
  followers: number;
  following: number;
  friends: number;
};

@Injectable()
export class FollowsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** Records the follow; a follow already there is left as it is. */
  async add(followerId: string, followingId: string): Promise<void> {
    await this.txHost.tx
      .insert(userFollows)
      .values({ followerId, followingId })
      .onConflictDoNothing({
        target: [userFollows.followerId, userFollows.followingId],
      });
  }

  async remove(followerId: string, followingId: string): Promise<void> {
    await this.txHost.tx
      .delete(userFollows)
      .where(
        and(
          eq(userFollows.followerId, followerId),
          eq(userFollows.followingId, followingId),
        ),
      );
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [row] = await this.txHost.tx
      .select({ id: userFollows.id })
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, followerId),
          eq(userFollows.followingId, followingId),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  /**
   * The followers, the following and the friends of a User. A friend is a
   * follow the other way round: the row of the follow the User made joins the
   * row where the other User follows them back.
   */
  async countsOf(userId: string): Promise<FollowCounts> {
    const followers = await this.countWhere(
      eq(userFollows.followingId, userId),
    );
    const following = await this.countWhere(eq(userFollows.followerId, userId));
    const friends = await this.countFriends(userId);
    return { followers, following, friends };
  }

  private async countWhere(condition: SQL): Promise<number> {
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(userFollows)
      .where(condition);
    return row?.value ?? 0;
  }

  private async countFriends(userId: string): Promise<number> {
    const followedBack = alias(userFollows, 'followed_back');
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(userFollows)
      .innerJoin(
        followedBack,
        and(
          eq(followedBack.followerId, userFollows.followingId),
          eq(followedBack.followingId, userFollows.followerId),
        ),
      )
      .where(eq(userFollows.followerId, userId));
    return row?.value ?? 0;
  }
}
