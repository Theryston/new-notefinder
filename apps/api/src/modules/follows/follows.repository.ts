import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { userFollows } from '../../database/schema/user-follows.js';

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
}
